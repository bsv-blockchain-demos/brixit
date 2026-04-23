// src/components/Map/InteractiveMap.tsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { BrixDataPoint } from '../../types';
import { useFormattedSubmissionByIdQuery, useFormattedSubmissionsBoundsQuery } from '../../hooks/useSubmissions';
import { useFilters } from '../../contexts/FilterContext';
import { applyFilters } from '../../lib/filterUtils';
import { Button } from '../ui/button';
import { MapPin, X, ArrowLeft } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import DataPointDetailModal from '../common/DataPointDetailModal';
import { useAuth } from '../../contexts/AuthContext';
import { getMapboxToken } from '@/lib/getMapboxToken';
import { useCropThresholds } from '../../contexts/CropThresholdContext';
import { computeNormalizedScore, rankColorFromNormalized, toDisplayScore, scoreBrix } from '../../lib/getBrixColor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import LocationSearch from '../common/LocationSearch';
import { useQueryClient } from '@tanstack/react-query';
import {
  fetchLocationLeaderboard,
  fetchCropLeaderboard,
  fetchBrandLeaderboard,
  type Filter,
} from '../../lib/fetchLeaderboards';

// Types

interface InteractiveMapProps {
  userLocation: { lat: number; lng: number } | null;
  nearMeTriggered?: boolean;
  onNearMeHandled?: () => void;
}

type SelectedView = { type: 'crop' | 'brand'; id: string; label: string } | null;

// Constants

const MIN_ZOOM_TO_QUERY = 2;
const BOUNDS_PADDING_RATIO = 0.25;
const MAP_QUERY_LIMIT = 2000;

// Module-level helpers (no closure over component state)

const safeStr = (v?: any) => (v === null || v === undefined ? '' : String(v));

const tierColorExpr = (scoreExpr: any): any => [
  'case',
  ['>=', scoreExpr, 1.75], '#2d6a4f',  // excellent — green-mid
  ['>=', scoreExpr, 1.5],  '#40916c',  // good      — green-fresh
  ['>=', scoreExpr, 1.25], '#c9a84c',  // average   — gold
  '#c0392b',                           // poor      — score-poor
];

function buildSubmissionsGeoJSON(
  data: BrixDataPoint[],
  cache: Record<string, any>,
  minBrix: number,
  maxBrix: number,
): any {
  const features = [];
  for (const point of data) {
    const lat = point.latitude ?? (point as any).lat;
    const lng = point.longitude ?? (point as any).lng;
    if (lat == null || lng == null) continue;
    const cropKey = (point.cropType ?? point.cropLabel ?? (point as any).crop_name ?? 'unknown').toString().toLowerCase().trim();
    const thresholds =
      (typeof point.poorBrix === 'number' && typeof point.excellentBrix === 'number')
        ? { poor: point.poorBrix, average: point.averageBrix ?? 0, good: point.goodBrix ?? 0, excellent: point.excellentBrix }
        : cache?.[cropKey] ?? null;
    const brixVal = point.brixLevel ?? (point as any).brix_value;
    const normalizedScore =
      typeof brixVal === 'number' && !isNaN(brixVal)
        ? computeNormalizedScore(brixVal, thresholds, minBrix, maxBrix)
        : 1.5;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: { id: point.id, normalizedScore },
    });
  }
  return { type: 'FeatureCollection', features };
}

// Component

const InteractiveMap: React.FC<InteractiveMapProps> = ({
  userLocation,
  nearMeTriggered,
  onNearMeHandled,
}) => {
  const location = useLocation();
  const [modalSubmission, setModalSubmission] = useState<BrixDataPoint | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { highlightedPoint } = (location.state || {}) as any;
  const { filters, isAdmin } = useFilters();

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  // Stable ref so map interaction handlers always see the latest filtered data
  const filteredDataRef = useRef<BrixDataPoint[]>([]);

  const [allData, setAllData] = useState<BrixDataPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<BrixDataPoint | null>(null);

  const [viewportQuery, setViewportQuery] = useState<
    { west: number; south: number; east: number; north: number; zoom: number } | null
  >(null);

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [groupBy, setGroupBy] = useState<'none' | 'crop' | 'brand'>('crop');
  const [searchValue, setSearchValue] = useState('');
  const [minBrix, setMinBrix] = useState<number>(0);
  const [maxBrix, setMaxBrix] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);

  const zoomLevel = viewportQuery?.zoom ?? 0;

  const submissionsQuery = useFormattedSubmissionsBoundsQuery(
    viewportQuery
      ? {
          west: viewportQuery.west,
          south: viewportQuery.south,
          east: viewportQuery.east,
          north: viewportQuery.north,
          limit: MAP_QUERY_LIMIT,
          sortBy: 'assessment_date',
          sortOrder: 'desc',
        }
      : undefined,
    {
      enabled: !!viewportQuery && viewportQuery.zoom >= MIN_ZOOM_TO_QUERY,
      staleTimeMs: 10 * 60 * 1000,
      gcTimeMs: 60 * 60 * 1000,
    }
  );

  const highlightedId = (highlightedPoint as any)?.id
    ? String((highlightedPoint as any).id)
    : undefined;
  const highlightedQuery = useFormattedSubmissionByIdQuery(highlightedId, {
    enabled: !!highlightedId,
    staleTimeMs: 10 * 60 * 1000,
    gcTimeMs: 60 * 60 * 1000,
  });

  const [selectedEntry, setSelectedEntry] = useState<SelectedView>(null);
  const [locationLeaderboard, setLocationLeaderboard] = useState<any[]>([]);
  const [cropLeaderboard, setCropLeaderboard] = useState<any[]>([]);
  const [brandLeaderboard, setBrandLeaderboard] = useState<any[]>([]);

  const { cache, loading: thresholdsLoading } = useCropThresholds();

  const [mobileSheetOpen, setMobileSheetOpen] = useState<boolean>(true);
  const isMobile = useIsMobile();

  function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(
      typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
    );
    useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth < breakpoint);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [breakpoint]);
    return isMobile;
  }

  const filteredData = useMemo(() => {
    try {
      return applyFilters(allData, filters, isAdmin);
    } catch (err) {
      console.error('Error applying filters:', err);
      return allData;
    }
  }, [allData, filters, isAdmin]);

  // Keep the ref current so stable click handlers can read latest data
  useEffect(() => {
    filteredDataRef.current = filteredData;
  }, [filteredData]);

  // Viewport-based submissions fetch
  useEffect(() => {
    if (viewportQuery && viewportQuery.zoom < MIN_ZOOM_TO_QUERY) {
      setAllData([]);
      return;
    }
    if (submissionsQuery.data) setAllData(submissionsQuery.data || []);
    if (submissionsQuery.error) {
      console.error('Error fetching submissions:', submissionsQuery.error);
      setAllData([]);
    }
  }, [submissionsQuery.data, submissionsQuery.error, viewportQuery]);

  // Open sheet and reset group when a point is selected
  useEffect(() => {
    if (selectedPoint) {
      setGroupBy('crop');
      setSelectedEntry(null);
      setMobileSheetOpen(true);
    }
  }, [selectedPoint]);

  const selectedPlaceId = useMemo(() => {
    if (!selectedPoint) return null;
    return (selectedPoint as any).placeId ?? (selectedPoint as any).place_id ?? null;
  }, [selectedPoint]);

  const placeSubmissions = useMemo(() => {
    if (!selectedPlaceId) return [] as BrixDataPoint[];
    return filteredData.filter(
      (d) => ((d as any).placeId ?? (d as any).place_id) === selectedPlaceId
    );
  }, [filteredData, selectedPlaceId]);

  type LocalRankEntry = {
    label: string;
    submission_count: number;
    average_normalized_score: number;
  };

  const placeCropRankings: LocalRankEntry[] = useMemo(() => {
    const groups = new Map<string, { total: number; count: number }>();
    for (const sub of placeSubmissions) {
      const cropKey = (sub.cropLabel ?? sub.cropType ?? (sub as any).crop_name ?? 'Unknown').toString();
      const thresholds =
        (typeof sub.poorBrix === 'number' && typeof sub.excellentBrix === 'number')
          ? { poor: sub.poorBrix, average: sub.averageBrix ?? 0, good: sub.goodBrix ?? 0, excellent: sub.excellentBrix }
          : cache?.[cropKey.toLowerCase().trim()] ?? null;
      const brixVal = sub.brixLevel ?? (sub as any).brix_value;
      const g = groups.get(cropKey) || { total: 0, count: 0 };
      if (typeof brixVal === 'number' && !isNaN(brixVal)) {
        g.total += computeNormalizedScore(brixVal, thresholds, minBrix, maxBrix);
        g.count += 1;
      }
      groups.set(cropKey, g);
    }
    return [...groups.entries()]
      .map(([label, g]) => ({
        label,
        submission_count: g.count,
        average_normalized_score: g.count ? g.total / g.count : 1.5,
      }))
      .sort((a, b) => b.average_normalized_score - a.average_normalized_score);
  }, [placeSubmissions, cache, minBrix, maxBrix]);

  const placeBrandRankings: LocalRankEntry[] = useMemo(() => {
    const groups = new Map<string, { total: number; count: number }>();
    for (const sub of placeSubmissions) {
      const brandKey = (sub.brandLabel ?? sub.brandName ?? (sub as any).brand_name ?? 'Unknown').toString();
      const cropKey = (sub.cropLabel ?? sub.cropType ?? (sub as any).crop_name ?? 'Unknown').toString();
      const thresholds =
        (typeof sub.poorBrix === 'number' && typeof sub.excellentBrix === 'number')
          ? { poor: sub.poorBrix, average: sub.averageBrix ?? 0, good: sub.goodBrix ?? 0, excellent: sub.excellentBrix }
          : cache?.[cropKey.toLowerCase().trim()] ?? null;
      const brixVal = sub.brixLevel ?? (sub as any).brix_value;
      const g = groups.get(brandKey) || { total: 0, count: 0 };
      if (typeof brixVal === 'number' && !isNaN(brixVal)) {
        g.total += computeNormalizedScore(brixVal, thresholds, minBrix, maxBrix);
        g.count += 1;
      }
      groups.set(brandKey, g);
    }
    return [...groups.entries()]
      .map(([label, g]) => ({
        label,
        submission_count: g.count,
        average_normalized_score: g.count ? g.total / g.count : 1.5,
      }))
      .sort((a, b) => b.average_normalized_score - a.average_normalized_score);
  }, [placeSubmissions, cache, minBrix, maxBrix]);

  // Min/max Brix from loaded data (fallback scoring range)
  useEffect(() => {
    if (!allData.length) return;
    const bVals = allData
      .map((d) => d.brixLevel ?? (d as any).brix_value)
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));
    if (bVals.length) {
      setMinBrix(Math.min(...bVals));
      setMaxBrix(Math.max(...bVals));
    }
  }, [allData]);

  // Near-me handler
  useEffect(() => {
    if (nearMeTriggered && userLocation && mapRef.current) {
      mapRef.current.easeTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 14,
        duration: 1000,
      });
      onNearMeHandled?.();
    }
  }, [nearMeTriggered, userLocation, onNearMeHandled]);

  // Initialize map, sources, layers, and interactions (runs once)
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const initialCenter: [number, number] = userLocation
      ? [userLocation.lng, userLocation.lat]
      : [0, 20];
    const initialZoom = userLocation ? 10 : 2;
    let mounted = true;

    (async function init() {
      const token = await getMapboxToken();
      if (!token) {
        console.error('Failed to retrieve Mapbox token. Map will not initialize.');
        return;
      }
      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: mapContainer.current!,
        // satellite-v9 = pure satellite imagery, zero road geometry by design.
        // We add only the place-label layers we want from the streets tileset.
        style: 'mapbox://styles/mapbox/satellite-v9',
        center: initialCenter,
        zoom: initialZoom,
      } as any);
      mapRef.current = map;

      map.on('load', () => {
        if (!mounted) return;

        // Place names only — no roads, POIs, or transit.
        // mapbox-streets-v8 place_label source layer contains country/state/settlement data.
        map.addSource('mapbox-streets', {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-streets-v8',
        });

        map.addLayer({
          id: 'place-country',
          type: 'symbol',
          source: 'mapbox-streets',
          'source-layer': 'place_label',
          maxzoom: 6,
          filter: ['==', ['get', 'class'], 'country'],
          layout: {
            'text-field': ['get', 'name_en'],
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 1, 11, 5, 16],
            'text-transform': 'uppercase',
            'text-letter-spacing': 0.15,
            'symbol-sort-key': ['get', 'rank'],
          },
          paint: {
            'text-color': 'rgba(255,255,255,0.9)',
            'text-halo-color': 'rgba(0,0,0,0.7)',
            'text-halo-width': 1.5,
          },
        } as any);

        map.addLayer({
          id: 'place-state',
          type: 'symbol',
          source: 'mapbox-streets',
          'source-layer': 'place_label',
          minzoom: 3,
          maxzoom: 8,
          filter: ['==', ['get', 'class'], 'state'],
          layout: {
            'text-field': ['get', 'name_en'],
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 7, 13],
            'symbol-sort-key': ['get', 'rank'],
          },
          paint: {
            'text-color': 'rgba(255,255,255,0.8)',
            'text-halo-color': 'rgba(0,0,0,0.6)',
            'text-halo-width': 1,
          },
        } as any);

        map.addLayer({
          id: 'place-settlement',
          type: 'symbol',
          source: 'mapbox-streets',
          'source-layer': 'place_label',
          minzoom: 4,
          filter: ['==', ['get', 'class'], 'settlement'],
          layout: {
            'text-field': ['get', 'name_en'],
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 12, 14],
            'symbol-sort-key': ['get', 'rank'],
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': 'rgba(0,0,0,0.6)',
            'text-halo-width': 1,
          },
        } as any);

        // Submissions source — Mapbox handles all clustering automatically
        map.addSource('submissions', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterMaxZoom: 13,
          clusterRadius: 50,
          // Accumulate score sum across cluster members so we can color by average
          clusterProperties: {
            scoreSum: ['+', ['get', 'normalizedScore']],
          },
        } as any);

        // Cluster circles — colored by average score across all points in the cluster
        map.addLayer({
          id: 'submissions-clusters',
          type: 'circle',
          source: 'submissions',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': tierColorExpr(['/', ['get', 'scoreSum'], ['get', 'point_count']]),
            'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 30, 200, 40],
            'circle-stroke-color': 'rgba(255,255,255,0.6)',
            'circle-stroke-width': 2,
            'circle-opacity': 1,
          },
        } as any);

        // Count label on each cluster
        map.addLayer({
          id: 'submissions-cluster-count',
          type: 'symbol',
          source: 'submissions',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12,
          },
          paint: { 'text-color': '#ffffff' },
        } as any);

        // Individual unclustered points
        map.addLayer({
          id: 'submissions-unclustered',
          type: 'circle',
          source: 'submissions',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': tierColorExpr(['get', 'normalizedScore']),
            'circle-radius': 7,
            'circle-stroke-color': 'white',
            'circle-stroke-width': 1.5,
            'circle-opacity': 1,
          },
        } as any);

        // Cursor: pointer over interactive layers
        const interactiveLayers = ['submissions-clusters', 'submissions-unclustered'];
        interactiveLayers.forEach((id) => {
          map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
        });

        // Click cluster → zoom in to expand
        map.on('click', 'submissions-clusters', (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['submissions-clusters'] });
          if (!features.length) return;
          const clusterId = (features[0].properties as any).cluster_id;
          const coords = (features[0].geometry as any).coordinates as [number, number];
          (map.getSource('submissions') as mapboxgl.GeoJSONSource)
            .getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err || zoom == null) return;
              map.easeTo({ center: coords, zoom });
            });
        });

        // Click individual point → open side panel
        map.on('click', 'submissions-unclustered', (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['submissions-unclustered'] });
          if (!features.length) return;
          const id = (features[0].properties as any).id;
          const sub = filteredDataRef.current.find((d) => d.id === id);
          if (sub) {
            setSelectedPoint(sub);
            setMobileSheetOpen(true);
          }
        });

        // Click empty map area → clear selection
        map.on('click', (e) => {
          const hit = map.queryRenderedFeatures(e.point, { layers: interactiveLayers });
          if (!hit.length) setSelectedPoint(null);
        });

        setIsMapLoaded(true);
      });

      map.on('error', (e) => console.error('Mapbox error:', e.error));
    })();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setIsMapLoaded(false);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Push new submission data into the Mapbox source whenever the filtered set changes
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return;
    const source = mapRef.current.getSource('submissions') as mapboxgl.GeoJSONSource | undefined;
    source?.setData(buildSubmissionsGeoJSON(filteredData, cache, minBrix, maxBrix));
  }, [filteredData, cache, minBrix, maxBrix, isMapLoaded]);

  // Update viewport query on move/zoom (debounced)
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;

    let timeout: any = null;

    const update = () => {
      if (!mapRef.current) return;
      const zoom = mapRef.current.getZoom();
      if (zoom < MIN_ZOOM_TO_QUERY) {
        setViewportQuery({ west: 0, south: 0, east: 0, north: 0, zoom });
        return;
      }
      const b = mapRef.current.getBounds();
      const west = b.getWest();
      const east = b.getEast();
      const south = b.getSouth();
      const north = b.getNorth();
      const padLng = (east - west) * BOUNDS_PADDING_RATIO;
      const padLat = (north - south) * BOUNDS_PADDING_RATIO;
      setViewportQuery({
        west: west - padLng,
        south: south - padLat,
        east: east + padLng,
        north: north + padLat,
        zoom,
      });
    };

    const scheduleUpdate = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(update, 300);
    };

    scheduleUpdate();
    mapRef.current.on('moveend', scheduleUpdate);
    mapRef.current.on('zoomend', scheduleUpdate);

    return () => {
      if (timeout) clearTimeout(timeout);
      if (mapRef.current) {
        mapRef.current.off('moveend', scheduleUpdate);
        mapRef.current.off('zoomend', scheduleUpdate);
      }
    };
  }, [isMapLoaded]);

  // Handle highlighted point from router state
  useEffect(() => {
    if (!highlightedPoint || !mapRef.current) return;
    const hpId = (highlightedPoint as any)?.id;
    const localPoint = hpId ? allData.find((d) => d.id === hpId) : null;
    const resolvedPoint = (localPoint ?? highlightedQuery.data) as any;
    if (!resolvedPoint) return;
    const lat = resolvedPoint.latitude ?? resolvedPoint.lat;
    const lng = resolvedPoint.longitude ?? resolvedPoint.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    mapRef.current.easeTo({ center: [lng, lat], zoom: 16, duration: 1000 });
    setSelectedPoint(resolvedPoint as BrixDataPoint);
  }, [highlightedPoint, allData, highlightedQuery.data]);

  // Fetch leaderboards whenever the selected point changes
  useEffect(() => {
    if (!selectedPoint) {
      setLocationLeaderboard([]);
      setCropLeaderboard([]);
      setBrandLeaderboard([]);
      return;
    }
    setIsLoading(true);
    const localFilters: Filter = {
      city: selectedPoint.city ?? (selectedPoint as any).city_name ?? undefined,
      state: selectedPoint.state ?? undefined,
      country: selectedPoint.country ?? undefined,
      limit: 25,
      offset: 0,
    };
    const staleTime = 5 * 60 * 1000;
    Promise.all([
      queryClient.fetchQuery({ queryKey: ['leaderboard', 'location', 'map', localFilters], queryFn: () => fetchLocationLeaderboard(localFilters), staleTime }),
      queryClient.fetchQuery({ queryKey: ['leaderboard', 'crop', 'map', localFilters], queryFn: () => fetchCropLeaderboard(localFilters), staleTime }),
      queryClient.fetchQuery({ queryKey: ['leaderboard', 'brand', 'map', localFilters], queryFn: () => fetchBrandLeaderboard(localFilters), staleTime }),
    ])
      .then(([loc, crop, brand]) => {
        setLocationLeaderboard((loc as any) || []);
        setCropLeaderboard((crop as any) || []);
        setBrandLeaderboard((brand as any) || []);
      })
      .catch((err) => {
        console.error('Error fetching leaderboard:', err);
        setLocationLeaderboard([]);
        setCropLeaderboard([]);
        setBrandLeaderboard([]);
      })
      .finally(() => setIsLoading(false));
  }, [selectedPoint, filters, queryClient]);

  // Render helpers

  const renderSubmissionItem = (sub: BrixDataPoint, key: string, navigable = false) => {
    const cropKey = (sub.cropType ?? sub.cropLabel ?? (sub as any).crop_name ?? 'unknown').toString().toLowerCase().trim();
    const thresholds =
      (typeof sub.poorBrix === 'number' && typeof sub.excellentBrix === 'number')
        ? { poor: sub.poorBrix, average: sub.averageBrix ?? 0, good: sub.goodBrix ?? 0, excellent: sub.excellentBrix }
        : cache?.[cropKey] ?? null;
    const brixVal = sub.brixLevel ?? (sub as any).brix_value;
    const score = typeof brixVal === 'number' ? scoreBrix(brixVal, thresholds ?? null, minBrix, maxBrix) : null;
    const canNavigate = navigable && !!user && !!sub.id;
    return (
      <div
        key={key}
        className={`flex justify-between items-start py-3 border-b border-green-pale last:border-b-0 ${canNavigate ? 'cursor-pointer hover:bg-green-mist rounded-lg px-2 -mx-2 transition-colors' : ''}`}
        onClick={canNavigate ? () => setModalSubmission(sub) : undefined}
      >
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-semibold text-sm truncate">
            {safeStr(sub.cropLabel ?? sub.cropType ?? 'Unknown Crop')}
          </span>
          <span className="text-xs text-text-muted-green mt-1 truncate">
            {safeStr(sub.brandLabel ?? sub.brandName ?? 'Unknown Brand')} —{' '}
            {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : '-'}
          </span>
        </div>
        <div className={`flex-shrink-0 min-w-[52px] px-3 py-1 text-center font-bold text-sm text-white rounded-full ${score?.bgClass ?? 'bg-gray-300'}`}>
          {score ? score.display : '—'}
        </div>
      </div>
    );
  };

  const renderDetailedSubmissions = () => {
    if (!selectedEntry || !selectedPoint) return null;
    const filteredSubmissions = placeSubmissions.filter((d) =>
      selectedEntry.type === 'crop'
        ? (d.cropLabel ?? d.cropType) === selectedEntry.label
        : (d.brandLabel ?? d.brandName) === selectedEntry.label
    );
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center space-x-2 pb-4 border-b mb-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedEntry(null)}>
            <ArrowLeft size={20} />
          </Button>
          <h4 className="font-display font-semibold text-base">
            Submissions for {selectedEntry.label} ({filteredSubmissions.length})
          </h4>
        </div>
        <div className="overflow-y-auto space-y-0">
          {filteredSubmissions.length > 0 ? (
            filteredSubmissions.map((sub) => renderSubmissionItem(sub, sub.id, true))
          ) : (
            <div className="text-center text-text-muted-green py-8">No submissions found.</div>
          )}
        </div>
      </div>
    );
  };

  const renderLeaderboard = () => {
    if (!selectedPoint) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-6">
          <MapPin className="w-16 h-16 text-green-light mb-4" />
          <p className="text-xl font-display font-semibold text-text-dark">Ready to Explore?</p>
          <p className="text-sm text-text-muted-green mt-2">
            <span className="md:hidden">Tap on a marker to view scores and rankings.</span>
            <span className="hidden md:inline">
              Click on a marker to view scores and rankings for that location.
            </span>
          </p>
        </div>
      );
    }

    if (isLoading || thresholdsLoading) {
      return <div className="p-4 text-center">Loading leaderboards...</div>;
    }

    if (selectedEntry) return renderDetailedSubmissions();

    return (
      <div className="h-full flex flex-col">
        <Tabs
          defaultValue="crop"
          value={groupBy}
          onValueChange={(val) => setGroupBy(val as any)}
          className="flex-1 flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="none">All</TabsTrigger>
            <TabsTrigger value="crop">Crop</TabsTrigger>
            <TabsTrigger value="brand">Brand</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="none" className="mt-0 h-full overflow-y-auto">
              <div>
                <h4 className="font-semibold mb-3 text-base">
                  All Submissions ({placeSubmissions.length})
                </h4>
                <div className="space-y-0">
                  {placeSubmissions.map((sub) => renderSubmissionItem(sub, sub.id, true))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="crop" className="mt-0 h-full overflow-y-auto">
              <div>
                <h4 className="font-semibold mb-3 text-base">Top Crops</h4>
                <div className="space-y-2">
                  {placeCropRankings.length === 0 ? (
                    <div className="text-sm text-text-muted-green p-3 text-center">No crop data.</div>
                  ) : (
                    placeCropRankings.map((c) => {
                      const n = Number(c.average_normalized_score ?? 1.5);
                      const { bgClass } = rankColorFromNormalized(n);
                      const label = c.label ?? 'Unknown';
                      return (
                        <div
                          key={label}
                          className="p-3 cursor-pointer hover:bg-green-mist active:bg-green-pale rounded-lg flex justify-between items-center transition-colors"
                          onClick={() => setSelectedEntry({ type: 'crop', id: label, label })}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{label}</div>
                            <div className="text-xs text-text-muted-green">
                              Submissions: {c.submission_count ?? '-'}
                            </div>
                          </div>
                          <div className={`w-14 h-7 rounded-full text-white flex items-center justify-center text-sm font-semibold ${bgClass}`}>
                            {toDisplayScore(n)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="brand" className="mt-0 h-full overflow-y-auto">
              <div>
                <h4 className="font-semibold mb-3 text-base">Top Brands</h4>
                <div className="space-y-2">
                  {placeBrandRankings.length === 0 ? (
                    <div className="text-sm text-text-muted-green p-3 text-center">No brand data.</div>
                  ) : (
                    placeBrandRankings.map((b) => {
                      const n = Number(b.average_normalized_score ?? 1.5);
                      const { bgClass } = rankColorFromNormalized(n);
                      const label = b.label ?? 'Unknown';
                      return (
                        <div
                          key={label}
                          className="p-3 cursor-pointer hover:bg-green-mist active:bg-green-pale rounded-lg flex justify-between items-center transition-colors"
                          onClick={() => setSelectedEntry({ type: 'brand', id: label, label })}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{label}</div>
                            <div className="text-xs text-text-muted-green">
                              Submissions: {b.submission_count ?? '-'}
                            </div>
                          </div>
                          <div className={`w-14 h-7 rounded-full text-white flex items-center justify-center text-sm font-semibold ${bgClass}`}>
                            {toDisplayScore(n)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    );
  };

  // Panel header values
  const locTitle = selectedPoint?.locationName ?? (selectedPoint as any)?.location_name ?? safeStr((selectedPoint as any)?.place_label ?? '');
  const street = selectedPoint?.streetAddress ?? (selectedPoint as any)?.street_address ?? '';
  const city = selectedPoint?.city ?? (selectedPoint as any)?.city ?? '';
  const state = selectedPoint?.state ?? (selectedPoint as any)?.state ?? '';

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] w-full">
      <div ref={mapContainer} className="flex-1 relative">
        <div className="absolute top-3 left-3 z-10 w-64 sm:w-80 shadow-lg rounded-xl overflow-visible">
          <LocationSearch
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onLocationSelect={(loc) => {
              if (mapRef.current && loc.latitude && loc.longitude) {
                mapRef.current.flyTo({
                  center: [loc.longitude, loc.latitude],
                  zoom: 10,
                  duration: 1200,
                });
              }
              setSearchValue('');
            }}
            placeholder="Search any location..."
          />
        </div>

        {isMapLoaded && zoomLevel > 0 && zoomLevel < MIN_ZOOM_TO_QUERY && (
          <div className="absolute inset-0 z-10 flex items-start justify-center pointer-events-none">
            <div className="mt-16 bg-card/90 backdrop-blur border border-border text-foreground px-4 py-2 rounded-md shadow-sm text-sm">
              Zoom in to load submissions
            </div>
          </div>
        )}
      </div>

      {/* Desktop right panel */}
      <div className="hidden md:flex md:w-96 flex-col border-l border-border bg-card shadow-inner">
        <div className="p-4 flex-shrink-0 flex flex-row items-start justify-between border-b">
          <div className="min-w-0">
            <h2 className="text-lg font-display font-semibold truncate">
              {locTitle || 'Location details'}
            </h2>
            {selectedPoint && (
              <p className="text-sm text-text-muted-green mt-1 truncate">
                {`${street ? `${street}, ` : ''}${city}${city && state ? `, ${state}` : state ? `, ${state}` : ''}`}
              </p>
            )}
          </div>
          {selectedPoint && (
            <Button
              onClick={() => setSelectedPoint(null)}
              variant="ghost"
              size="icon"
            >
              <X size={20} />
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4">{renderLeaderboard()}</div>
      </div>

      {/* Mobile bottom sheet */}
      {isMobile && (
        <>
          <BottomSheet
            open={mobileSheetOpen}
            onOpenChange={setMobileSheetOpen}
            title={locTitle || 'Location details'}
            className="pointer-events-auto"
          >
            <div className="mb-4">{renderLeaderboard()}</div>
          </BottomSheet>

          {!mobileSheetOpen && (
            <div className="fixed bottom-4 right-4 z-50">
              <Button
                onClick={() => setMobileSheetOpen(true)}
                variant="default"
                size="sm"
                className="shadow-lg bg-primary text-primary-foreground hover:bg-green-mid"
              >
                Explore BRIX Data
              </Button>
            </div>
          )}
        </>
      )}

      <DataPointDetailModal
        dataPoint={modalSubmission}
        isOpen={!!modalSubmission}
        onClose={() => setModalSubmission(null)}
      />
    </div>
  );
};

export default InteractiveMap;
