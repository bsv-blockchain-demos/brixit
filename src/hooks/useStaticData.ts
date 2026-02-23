import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCropTypes } from '../lib/fetchCropTypes';
import { fetchBrands } from '../lib/fetchBrands';
import { fetchLocations } from '../lib/fetchLocations';

// Interface for a generic database item.
interface DatabaseItem {
  id: string;
  name: string;
  label?: string;
}

// Interface for the static data returned by the hook.
// This now includes a 'refreshData' function.
interface StaticData {
  crops: DatabaseItem[];
  brands: DatabaseItem[];
  locations: DatabaseItem[];
  isLoading: boolean;
  error: string | null;
  refreshData: () => void; // Added the refreshData function to the interface
}

const initialData = {
  crops: [],
  brands: [],
  locations: [],
  isLoading: true,
  error: null,
};

const ONE_HOUR_MS = 60 * 60 * 1000;

// Helper function to safely convert any data to DatabaseItem format
const normalizeToItems = (data: any[], type: string): DatabaseItem[] => {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  return data.map((item, index) => {
    // If it's already a proper object with id and name
    if (item && typeof item === 'object' && 'id' in item && 'name' in item && typeof item.name === 'string') {
      return {
        id: String(item.id),
        name: item.name,
        label: item.label || item.name,
      };
    }

    // If it's a string
    if (typeof item === 'string') {
      return {
        id: `temp-${type}-${index}`,
        name: item,
        label: item,
      };
    }

    // If it's an object but without proper structure, try to extract name
    if (item && typeof item === 'object') {
      const name = item.name || item.title || item.label || String(item);
      const label = item.label || name;
      return {
        id: `temp-${type}-${index}`,
        name: typeof name === 'string' ? name : `Unknown ${type} ${index}`,
        label: typeof label === 'string' ? label : `Unknown ${type} ${index}`,
      };
    }

    // Fallback for any other type
    return {
      id: `temp-${type}-${index}`,
      name: `Unknown ${type} ${index}`,
      label: `Unknown ${type} ${index}`,
    };
  });
};

async function fetchStaticData(): Promise<Pick<StaticData, 'crops' | 'brands' | 'locations'>> {
  const [cropsResult, brandsResult, locationsResult] = await Promise.all([
    fetchCropTypes().catch(() => []),
    fetchBrands().catch(() => []),
    fetchLocations().catch(() => []),
  ]);

  return {
    crops: normalizeToItems(cropsResult as any[], 'crop'),
    brands: normalizeToItems(brandsResult as any[], 'brand'),
    locations: normalizeToItems(locationsResult as any[], 'location'),
  };
}

export const useStaticData = (): StaticData => {
  const query = useQuery({
    queryKey: ['staticData'],
    queryFn: fetchStaticData,
    staleTime: ONE_HOUR_MS,
    gcTime: 2 * ONE_HOUR_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const refreshData = useCallback(() => {
    query.refetch();
  }, [query.refetch]);

  const error = useMemo(() => {
    if (!query.error) return null;
    if (query.error instanceof Error) return query.error.message;
    return 'Failed to load static data';
  }, [query.error]);

  const payload = query.data ?? {
    crops: initialData.crops,
    brands: initialData.brands,
    locations: initialData.locations,
  };

  return {
    crops: payload.crops,
    brands: payload.brands,
    locations: payload.locations,
    isLoading: query.isLoading,
    error,
    refreshData,
  };
};