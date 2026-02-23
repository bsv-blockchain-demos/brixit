// src/components/Map/InteractiveMap.tsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { BrixDataPoint } from '../../types';
import { useFormattedSubmissionByIdQuery, useFormattedSubmissionsBoundsQuery } from '../../hooks/useSubmissions';
import { useFilters } from '../../contexts/FilterContext';
import { applyFilters } from '../../lib/filterUtils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { MapPin, X, ArrowLeft } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { getMapboxToken } from '@/lib/getMapboxToken';
import { useCropThresholds } from '../../contexts/CropThresholdContext';
import { getBrixColor, computeNormalizedScore, rankColorFromNormalized } from '../../lib/getBrixColor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { BottomSheet } from '@/components/ui/bottom-sheet';

import { useQueryClient } from '@tanstack/react-query';

// Leaderboard API imports
import {
  fetchLocationLeaderboard,
  fetchCropLeaderboard,
  fetchBrandLeaderboard,
  LeaderboardEntry,
  type Filter,
} from '../../lib/fetchLeaderboards';

interface InteractiveMapProps {
  userLocation: { lat: number; lng: number } | null;
  nearMeTriggered?: boolean;
  onNearMeHandled?: () => void;
}

type SelectedView =
  | {
      type: 'crop' | 'brand';
      id: string;
      label: string;
    }
  | null;

const safeStr = (v?: any) => (v === null || v === undefined ? '' : String(v));

const InteractiveMap: React.FC<InteractiveMapProps> = ({
  userLocation,
  nearMeTriggered,
  onNearMeHandled,
}) => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { highlightedPoint } = (location.state || {}) as any;
  const { filters, isAdmin } = useFilters();

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const [allData, setAllData] = useState<BrixDataPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<BrixDataPoint | null>(null);

  const MIN_ZOOM_TO_QUERY = 6;
  const BOUNDS_PADDING_RATIO = 0.25;
  const MAP_QUERY_LIMIT = 2000;

  const [viewportQuery, setViewportQuery] = useState<
    | {
        west: number;
        south: number;
        east: number;
        north: number;
        zoom: number;
      }
    | null
  >(null);

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [groupBy, setGroupBy] = useState<'none' | 'crop' | 'brand'>('crop');
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

  const highlightedId = (highlightedPoint as any)?.id ? String((highlightedPoint as any).id) : undefined;
  const highlightedQuery = useFormattedSubmissionByIdQuery(highlightedId, {
    enabled: !!highlightedId,
    staleTimeMs: 10 * 60 * 1000,
    gcTimeMs: 60 * 60 * 1000,
  });

  const [selectedEntry, setSelectedEntry] = useState<SelectedView>(null);
  const [locationLeaderboard, setLocationLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [cropLeaderboard, setCropLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [brandLeaderboard, setBrandLeaderboard] = useState<LeaderboardEntry[]>([]);

  const { cache, loading: thresholdsLoading } = useCropThresholds();

  // mobile sheet visibility (start open by default)
  const [mobileSheetOpen, setMobileSheetOpen] = useState<boolean>(true);
  const isMobile = useIsMobile();

  // determine if mobile device
  function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(
      typeof window !== "undefined" ? window.innerWidth < breakpoint : false
    );
  
    useEffect(() => {
      function handleResize() {
        setIsMobile(window.innerWidth < breakpoint);
      }
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, [breakpoint]);
  
    return isMobile;
  }

  // Viewport-based submissions fetch
  useEffect(() => {
    if (viewportQuery && viewportQuery.zoom < MIN_ZOOM_TO_QUERY) {
      setAllData([]);
      return;
    }

    if (submissionsQuery.data) {
      setAllData(submissionsQuery.data || []);
    }
    if (submissionsQuery.error) {
      console.error('Error fetching submissions:', submissionsQuery.error);
      setAllData([]);
    }
  }, [submissionsQuery.data, submissionsQuery.error, viewportQuery]);

  // When a point is selected, ensure group and entry state are set
  useEffect(() => {
    if (selectedPoint) {
      setGroupBy('crop');
      setSelectedEntry(null);
      // open mobile sheet when user selects a marker
      setMobileSheetOpen(true);
    }
  }, [selectedPoint]);

  const filteredData = useMemo(() => {
    try {
      return applyFilters(allData, filters, isAdmin);
    } catch (err) {
      console.error('Error applying filters:', err);
      return allData;
    }
  }, [allData, filters, isAdmin]);

  // Base dataset for the selected place (uses filteredData for consistency with map)
  const selectedPlaceId = useMemo(() => {
    if (!selectedPoint) return null;
    return (selectedPoint as any).placeId ?? (selectedPoint as any).place_id ?? null;
  }, [selectedPoint]);

  const placeSubmissions = useMemo(() => {
    if (!selectedPlaceId) return [] as BrixDataPoint[];
    return filteredData.filter((d) => ((d as any).placeId ?? (d as any).place_id) === selectedPlaceId);
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
      const thresholds = cache?.[cropKey] ?? null;
      const brixVal = sub.brixLevel ?? (sub as any).brix_value;
      if (typeof brixVal === 'number' && !isNaN(brixVal)) {
        const norm = computeNormalizedScore(brixVal, thresholds, minBrix, maxBrix);
        const g = groups.get(cropKey) || { total: 0, count: 0 };
        g.total += norm;
        g.count += 1;
        groups.set(cropKey, g);
      } else {
        const g = groups.get(cropKey) || { total: 0, count: 0 };
        groups.set(cropKey, g);
      }
    }
    const out: LocalRankEntry[] = [];
    for (const [label, g] of groups.entries()) {
      out.push({ label, submission_count: g.count, average_normalized_score: g.count ? g.total / g.count : 1.5 });
    }
    out.sort((a, b) => b.average_normalized_score - a.average_normalized_score);
    return out;
  }, [placeSubmissions, cache, minBrix, maxBrix]);

  const placeBrandRankings: LocalRankEntry[] = useMemo(() => {
    const groups = new Map<string, { total: number; count: number }>();
    for (const sub of placeSubmissions) {
      const brandKey = (sub.brandLabel ?? sub.brandName ?? (sub as any).brand_name ?? 'Unknown').toString();
      const cropKey = (sub.cropLabel ?? sub.cropType ?? (sub as any).crop_name ?? 'Unknown').toString();
      const thresholds = cache?.[cropKey] ?? null;
      const brixVal = sub.brixLevel ?? (sub as any).brix_value;
      if (typeof brixVal === 'number' && !isNaN(brixVal)) {
        const norm = computeNormalizedScore(brixVal, thresholds, minBrix, maxBrix);
        const g = groups.get(brandKey) || { total: 0, count: 0 };
        g.total += norm;
        g.count += 1;
        groups.set(brandKey, g);
      } else {
        const g = groups.get(brandKey) || { total: 0, count: 0 };
        groups.set(brandKey, g);
      }
    }
    const out: LocalRankEntry[] = [];
    for (const [label, g] of groups.entries()) {
      out.push({ label, submission_count: g.count, average_normalized_score: g.count ? g.total / g.count : 1.5 });
    }
    out.sort((a, b) => b.average_normalized_score - a.average_normalized_score);
    return out;
  }, [placeSubmissions, cache, minBrix, maxBrix]);

  // compute min/max Brix
  useEffect(() => {
    if (!allData || allData.length === 0) return;
    const bVals = allData
      .map((d) => d.brixLevel ?? (d as any).brix_value)
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));
    if (bVals.length > 0) {
      setMinBrix(Math.min(...bVals));
      setMaxBrix(Math.max(...bVals));
    }
  }, [allData]);

  // near me handling
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

  // initialize Mapbox map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !userLocation) return;

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
        style: 'mapbox://styles/mapbox/satellite-v9',
        center: [userLocation.lng, userLocation.lat],
        zoom: 10,
      });
      mapRef.current = map;
      map.on('load', () => {
        if (!mounted) return;
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
  }, [userLocation]);

  // Update viewport query on moveend/zoomend (debounced)
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

  // handle highlighted point (from navigation state)
  useEffect(() => {
    if (!highlightedPoint || !mapRef.current) return;

    const hpId = (highlightedPoint as any)?.id;
    const localPoint = hpId ? allData.find((d) => d.id === hpId) : null;
    const resolvedPoint = (localPoint ?? highlightedQuery.data) as any;

    if (!resolvedPoint) return;

    const lat = resolvedPoint.latitude ?? resolvedPoint.lat;
    const lng = resolvedPoint.longitude ?? resolvedPoint.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') return;

    mapRef.current.easeTo({
      center: [lng, lat],
      zoom: 16,
      duration: 1000,
    });
    setSelectedPoint(resolvedPoint as BrixDataPoint);
  }, [highlightedPoint, allData, highlightedQuery.data]);

  // Draw markers and attach click handlers
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;

    // Remove previous markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const storeGroups: Record<string, BrixDataPoint[]> = {};
    const averageScores: Record<string, number> = {};

    for (const point of filteredData) {
      const lat = point.latitude ?? (point as any).lat;
      const lon = point.longitude ?? (point as any).lng;
      const locName = point.locationName ?? (point as any).location_name ?? (point as any).place_label ?? null;
      if (!lat || !lon || !locName) continue;
      if (!storeGroups[locName]) storeGroups[locName] = [];
      storeGroups[locName].push(point);
    }

    Object.entries(storeGroups).forEach(([storeName, points]) => {
      if (!points || points.length === 0) return;

      let totalScore = 0;
      let validCount = 0;

      for (const p of points) {
        const cropKey = (p.cropType ?? p.cropLabel ?? (p as any).crop_name ?? 'unknown').toString();
        const thresholds = cache?.[cropKey];

        let normalized = 1.5;
        const brixVal = p.brixLevel ?? (p as any).brix_value;
        if (typeof brixVal === 'number' && !isNaN(brixVal)) {
          normalized = computeNormalizedScore(brixVal, thresholds ?? null, minBrix, maxBrix);
          totalScore += normalized;
          validCount++;
        }
      }

      averageScores[storeName] = validCount > 0 ? totalScore / validCount : 1.5;

      const first = points[0];
      const lat = first.latitude ?? (first as any).lat;
      const lon = first.longitude ?? (first as any).lng;
      if (!lat || !lon) return;

      const markerHex = getBrixColor(
        averageScores[storeName],
        { poor: 1.0, average: 1.25, good: 1.5, excellent: 1.75 },
        'hex'
      );

      // build marker element (keeps your original styling)
      const markerContainer = document.createElement('div');
      markerContainer.className = 'flex flex-col items-center cursor-pointer select-none';

      const dot = document.createElement('div');
      dot.style.backgroundColor = markerHex;
      dot.style.width = '12px';
      dot.style.height = '12px';
      dot.style.borderRadius = '50%';
      dot.style.border = '2px solid white';
      dot.style.boxShadow = '0 0 5px rgba(0,0,0,0.5)';
      markerContainer.appendChild(dot);

      const label = document.createElement('div');
      label.innerText = storeName;
      label.style.backgroundColor = 'rgba(0,0,0,0.6)';
      label.style.color = 'white';
      label.style.padding = '2px 8px';
      label.style.borderRadius = '4px';
      label.style.fontSize = '12px';
      label.style.fontWeight = '600';
      label.style.whiteSpace = 'nowrap';
      label.style.maxWidth = '140px';
      label.style.overflow = 'hidden';
      label.style.textOverflow = 'ellipsis';
      markerContainer.appendChild(label);

      const marker = new mapboxgl.Marker({ element: markerContainer, anchor: 'bottom' })
        .setLngLat([lon, lat])
        .addTo(mapRef.current!);

      markersRef.current.push(marker);

      // clicking a marker selects the first submission (representative) at that location
      markerContainer.addEventListener('click', () => {
        setSelectedPoint(first);
        setMobileSheetOpen(true); // ensure mobile sheet re-opens if user previously closed it
      });
    });

    // clicking map (not markers) clears selection
    const mapClickListener = (e: mapboxgl.MapMouseEvent) => {
      const isMarkerClick = markersRef.current.some((m) =>
        m.getElement().contains(e.originalEvent.target as Node)
      );
      if (!isMarkerClick) {
        setSelectedPoint(null);
      }
    };

    mapRef.current.on('click', mapClickListener);
    return () => {
      if (mapRef.current) mapRef.current.off('click', mapClickListener);
    };
  }, [filteredData, isMapLoaded, cache, minBrix, maxBrix]);

  // Leaderboards fetching when a point selected
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

    const getLoc = () =>
      queryClient.fetchQuery({
        queryKey: ['leaderboard', 'location', 'map', localFilters],
        queryFn: () => fetchLocationLeaderboard(localFilters),
        staleTime,
      });

    const getCrop = () =>
      queryClient.fetchQuery({
        queryKey: ['leaderboard', 'crop', 'map', localFilters],
        queryFn: () => fetchCropLeaderboard(localFilters),
        staleTime,
      });

    const getBrand = () =>
      queryClient.fetchQuery({
        queryKey: ['leaderboard', 'brand', 'map', localFilters],
        queryFn: () => fetchBrandLeaderboard(localFilters),
        staleTime,
      });

    Promise.all([getLoc(), getCrop(), getBrand()])
      .then(([loc, crop, brand]) => {
        // adapt returned shape into LeaderboardEntry[] if necessary
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

  // Render helpers (kept your original markup and logic)
  const renderSubmissionItem = (sub: BrixDataPoint, key: string) => {
    const cropKey = (sub.cropType ?? sub.cropLabel ?? (sub as any).crop_name ?? 'unknown').toString();
    const thresholds = cache?.[cropKey];
    const brixVal = sub.brixLevel ?? (sub as any).brix_value;
    const pillClass = getBrixColor(
      typeof brixVal === 'number' ? brixVal : null,
      thresholds ?? {
        poor: minBrix,
        average: (minBrix + maxBrix) / 2,
        good: maxBrix * 0.8,
        excellent: maxBrix,
      },
      'bg'
    );

    return (
      <div key={key} className="flex justify-between items-start py-3 border-b border-gray-100 last:border-b-0">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-semibold text-sm truncate">{safeStr(sub.cropLabel ?? sub.cropType ?? 'Unknown Crop')}</span>
          <span className="text-xs text-gray-500 mt-1 truncate">
            {safeStr(sub.brandLabel ?? sub.brandName ?? 'Unknown Brand')} —{' '}
            {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : '-'}
          </span>
        </div>
        <div
          className={`flex-shrink-0 min-w-[48px] px-3 py-1 text-center font-bold text-sm text-white rounded-full ${pillClass}`}
        >
          {typeof brixVal === 'number' ? brixVal : '—'}
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
          <h4 className="font-semibold text-base">
            Submissions for {selectedEntry.label} ({filteredSubmissions.length})
          </h4>
        </div>
        <div className="overflow-y-auto space-y-0">
          {filteredSubmissions.length > 0 ? (
            filteredSubmissions.map((sub) => renderSubmissionItem(sub, sub.id))
          ) : (
            <div className="text-center text-gray-500 py-8">No submissions found.</div>
          )}
        </div>
      </div>
    );
  };

  const renderLeaderboard = () => {
    if (!selectedPoint) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-6">
          <MapPin className="w-16 h-16 text-gray-300 mb-4" />
          <p className="text-xl font-semibold text-gray-700">Ready to Explore?</p>
          <p className="text-sm text-gray-500 mt-2">
            <span className="md:hidden">Tap on a marker to view detailed bionutrient rankings.</span>
            <span className="hidden md:inline">Click on a marker to view detailed bionutrient rankings and data for that location.</span>
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
        <Tabs defaultValue="crop" value={groupBy} onValueChange={(val) => setGroupBy(val as any)} className="flex-1 flex flex-col">
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
                  {placeSubmissions.map((sub) => renderSubmissionItem(sub, sub.id))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="crop" className="mt-0 h-full overflow-y-auto">
              <div>
                <h4 className="font-semibold mb-3 text-base">Top Crops</h4>
                <div className="space-y-2">
                  {placeCropRankings.length === 0 ? (
                    <div className="text-sm text-gray-500 p-3 text-center">No crop data.</div>
                  ) : (
                    placeCropRankings.map((c) => {
                      const normalized = Number(c.average_normalized_score ?? 1.5);
                      const rankColor = rankColorFromNormalized(normalized);
                      const label = c.label ?? 'Unknown';
                      return (
                        <div
                          key={label}
                          className="p-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 rounded-lg flex justify-between items-center transition-colors"
                          onClick={() =>
                            setSelectedEntry({
                              type: 'crop',
                              id: label,
                              label,
                            })
                          }
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{label}</div>
                            <div className="text-xs text-gray-500">Submissions: {c.submission_count ?? '-'}</div>
                          </div>
                          <div
                            className={`w-14 h-7 rounded-full text-white flex items-center justify-center text-sm font-semibold ${rankColor.bgClass}`}
                          >
                            {normalized.toFixed(1)}
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
                    <div className="text-sm text-gray-500 p-3 text-center">No brand data.</div>
                  ) : (
                    placeBrandRankings.map((b) => {
                      const normalized = Number(b.average_normalized_score ?? 1.5);
                      const rankColor = rankColorFromNormalized(normalized);
                      const label = b.label ?? 'Unknown';
                      return (
                        <div
                          key={label}
                          className="p-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 rounded-lg flex justify-between items-center transition-colors"
                          onClick={() =>
                            setSelectedEntry({
                              type: 'brand',
                              id: label,
                              label,
                            })
                          }
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{label}</div>
                            <div className="text-xs text-gray-500">Submissions: {b.submission_count ?? '-'}</div>
                          </div>
                          <div
                            className={`w-14 h-7 rounded-full text-white flex items-center justify-center text-sm font-semibold ${rankColor.bgClass}`}
                          >
                            {normalized.toFixed(1)}
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
      {/* Map container must be non-zero height for Mapbox to render correctly */}
      <div ref={mapContainer} className="flex-1 relative">
        {isMapLoaded && zoomLevel > 0 && zoomLevel < MIN_ZOOM_TO_QUERY && (
          <div className="absolute inset-0 z-10 flex items-start justify-center pointer-events-none">
            <div className="mt-4 bg-white/90 backdrop-blur border border-gray-200 text-gray-800 px-4 py-2 rounded-md shadow-sm text-sm">
              Zoom in to load submissions
            </div>
          </div>
        )}
      </div>

     {/* Desktop Right Panel (persistent, integrated into layout) */}
      <div className="hidden md:flex md:w-96 flex-col border-l border-gray-200 bg-white shadow-inner">
        <div className="p-4 flex-shrink-0 flex flex-row items-start justify-between border-b">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold truncate">
              {locTitle || "Location details"}
            </h2>
            {selectedPoint && (
              <p className="text-sm text-gray-500 mt-1 truncate">
                {`${street ? `${street}, ` : ""}${city}${
                  city && state ? `, ${state}` : state ? `, ${state}` : ""
                }`}
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

      {/* Mobile BottomSheet — only render when actually mobile */}
        {isMobile && (
          <>
            <BottomSheet
              open={mobileSheetOpen}
              onOpenChange={setMobileSheetOpen}
              title={locTitle || "Location details"}
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
                  className="shadow-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Explore BRIX Data
                </Button>
              </div>
            )}
          </>
        )}
    </div>
  );
};

export default InteractiveMap;
