import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '../ui/input';
import { Loader2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMapboxToken } from '@/lib/getMapboxToken';

interface LocationSuggestion {
  mapbox_id: string;
  name: string;
  full_address?: string;
  place_formatted?: string;
}

interface DetailedLocationInfo {
  name: string;
  latitude: number;
  longitude: number;
  street_address?: string;
  city?: string;
  state?: string;
  country?: string;
  poi_name?: string;
  normalized_address?: string;
  business_name?: string;
}

interface LocationSearchProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLocationSelect: (location: DetailedLocationInfo) => void;
  isLoading?: boolean;
  placeholder?: string;
}

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const LocationSearch: React.FC<LocationSearchProps> = ({
  value,
  onChange,
  onLocationSelect,
  isLoading = false,
  placeholder = 'Enter an address or store name',
}) => {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [hasSelected, setHasSelected] = useState(false);

  const sessionRef = useRef<string | null>(null);
  const selectedValueRef = useRef<string | null>(null);

  useEffect(() => {
    sessionRef.current = generateUUID();

    const fetchToken = async () => {
      try {
        const token = await getMapboxToken();
        setMapboxToken(token);
      } catch (e) {
        console.error('Failed to load Mapbox token for search:', e);
        setMapboxToken(null);
      }
    };
    fetchToken();
  }, []);

  const searchLocations = useCallback(async (query: string, signal: AbortSignal) => {
    if (!mapboxToken || !sessionRef.current || query.length < 2) {
      setSuggestions([]);
      return;
    }

    if (query === selectedValueRef.current) {
      setSuggestions([]);
      return;
    }

    setIsSearching(true);
    try {
      const url = `https://api.mapbox.com/search/searchbox/v1/suggest`;
      const params = new URLSearchParams({
        q: query,
        access_token: mapboxToken,
        session_token: sessionRef.current,
        limit: '5',
        language: 'en',
        types: 'address,poi,place,locality'
      });

      const response = await fetch(`${url}?${params}`, {
        signal,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mapbox API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const transformedSuggestions: LocationSuggestion[] = data.suggestions?.map((s: any) => ({
        mapbox_id: s.mapbox_id,
        name: s.name,
        full_address: s.full_address,
        place_formatted: s.place_formatted,
      })) || [];

      setSuggestions(transformedSuggestions);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('Location search error:', e);
        setSuggestions([]);
      }
    } finally {
      setIsSearching(false);
    }
  }, [mapboxToken]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      const query = value.trim();

      if (!hasSelected && query) {
        searchLocations(query, controller.signal);
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [value, searchLocations, hasSelected]);

  const extractDetailedLocationInfo = (feature: any): DetailedLocationInfo => {
    const [longitude, latitude] = feature.geometry.coordinates;
    const properties = feature.properties || {};
    const context = properties.context || {};

    const isPoi = properties.feature_type === 'poi';
    const poi_name = isPoi ? (properties.name || '') : '';
    const business_name = (isPoi && properties.category) ? (properties.name || '') : '';

    let street_address = '';

    
    if (properties.address_number || properties.street) {
      const parts = [];
      if (properties.address_number) parts.push(properties.address_number);
      if (properties.street) parts.push(properties.street);
      street_address = parts.join(' ');
    }

    if (!street_address && properties.full_address) {
      street_address = properties.full_address; // fallback
    }

    const city = context.place?.name || context.locality?.name || '';
    const state = context.region?.name || context.region?.region_code || '';
    const country = context.country?.name || context.country?.country_code || '';

    const address_components = [street_address, city, state].filter(Boolean);
    const normalized_address = address_components.join(', ').toLowerCase().trim();

    const display_name = properties.full_address ||
      properties.place_formatted ||
      `${street_address}${city ? ', ' + city : ''}`.trim() ||
      poi_name ||
      'Unknown Location';

    return {
      name: display_name,
      latitude,
      longitude,
      street_address: street_address || undefined,
      city: city || undefined,
      state: state || undefined,
      country: country || undefined,
      poi_name: poi_name || undefined,
      business_name: business_name || undefined,
      normalized_address: normalized_address || undefined
    };
  };

  const handleSelect = async (suggestion: LocationSuggestion) => {
    if (!mapboxToken || !sessionRef.current) return;

    const locationName = suggestion.full_address || suggestion.name;

    selectedValueRef.current = locationName;
    setHasSelected(true);

    onChange({
      target: { value: locationName }
    } as React.ChangeEvent<HTMLInputElement>);

    setSuggestions([]);
    setIsSearching(true);

    try {
      const retrieveUrl = `https://api.mapbox.com/search/searchbox/v1/retrieve/${suggestion.mapbox_id}`;
      const retrieveParams = new URLSearchParams({
        access_token: mapboxToken,
        session_token: sessionRef.current,
      });

      const response = await fetch(`${retrieveUrl}?${retrieveParams}`);
      if (!response.ok) {
        throw new Error(`Failed to retrieve coordinates: ${response.status}`);
      }

      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const detailedInfo = extractDetailedLocationInfo(feature);

        onLocationSelect(detailedInfo);
      } else {
        // Fallback if no detailed data
        onLocationSelect({
          name: locationName,
          latitude: 0,
          longitude: 0
        });
      }
    } catch (e) {
      console.error('Failed to get location coordinates:', e);
      onLocationSelect({
        name: locationName,
        latitude: 0,
        longitude: 0
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    selectedValueRef.current = null;
    setHasSelected(false);
    onChange(e);
  };

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="pl-10"
        />
        {(isLoading || isSearching) && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>

      {!hasSelected && suggestions.length > 0 && (
        <div className="absolute z-50 w-full bg-card border border-border rounded-md shadow-lg mt-1 max-h-48 overflow-auto">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.mapbox_id}
              className="p-3 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0 transition-colors"
              onClick={() => handleSelect(suggestion)}
            >
              <div className="font-medium text-gray-900">
                {suggestion.name}
              </div>
              {suggestion.full_address && suggestion.full_address !== suggestion.name && (
                <div className="text-gray-500 text-xs mt-1">
                  {suggestion.full_address}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!hasSelected && value.length >= 2 && !isSearching && suggestions.length === 0 && (
        <div className="absolute z-50 w-full bg-card border border-border rounded-md shadow-lg mt-1 p-3">
          <div className="text-sm text-gray-500">
            No locations found. Try a different search term.
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationSearch;