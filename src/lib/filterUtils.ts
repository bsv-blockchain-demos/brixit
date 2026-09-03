// src/lib/filterUtils.ts

import { BrixDataPoint, MapFilter } from '../types'; // Removed QueryData from here
import { DEFAULT_MAP_FILTERS } from '../contexts/FilterContext'; // Import DEFAULT_MAP_FILTERS

export function applyFilters(data: BrixDataPoint[], filters: MapFilter, isAdmin: boolean = false): BrixDataPoint[] {
  const filtered = data.filter((point) => {
    // Verified filter - for non-admin users, always filter to verified only
    // If isAdmin is false, filters.verifiedOnly is automatically true via context logic.
    // So, this condition effectively means: if not admin, or if admin AND verifiedOnly is true.
    if (!isAdmin && DEFAULT_MAP_FILTERS.verifiedOnly) { // If not admin, always enforce verified only
        if (!point.verified) {
            return false;
        }
    } else if (isAdmin && filters.verifiedOnly) { // If admin, and they explicitly selected verifiedOnly
        if (!point.verified) {
            return false;
        }
    }

    // Crop types filter
    if (filters.cropTypes.length > 0 && !filters.cropTypes.includes(point.cropType)) {
      return false;
    }

    // Category filter
    // Check if a category is set AND it's different from the default (empty string)
    if (filters.category && filters.category !== DEFAULT_MAP_FILTERS.category && point.category !== filters.category) {
      return false;
    }

    // Brand filter - case-insensitive comparison with point.brandName - use includes for partial matching
    if (filters.brand && filters.brand !== DEFAULT_MAP_FILTERS.brand) {
      if (!point.brandName || !point.brandName.toLowerCase().includes(filters.brand.toLowerCase())) {
        return false;
      }
    }

    // Place filter - match against locationName (store chain) or placeName (specific location)
    if (filters.place && filters.place !== DEFAULT_MAP_FILTERS.place) {
      const placeMatches = (point.locationName && point.locationName.toLowerCase().includes(filters.place.toLowerCase())) ||
                          (point.placeName && point.placeName.toLowerCase().includes(filters.place.toLowerCase()));
      if (!placeMatches) {
        return false;
      }
    }

    // Location filter - for backward compatibility, same as place filter
    if (filters.location && filters.location !== DEFAULT_MAP_FILTERS.location) {
      const locationMatches = (point.locationName && point.locationName.toLowerCase().includes(filters.location.toLowerCase())) ||
                             (point.placeName && point.placeName.toLowerCase().includes(filters.location.toLowerCase()));
      if (!locationMatches) {
        return false;
      }
    }

    // Brix range filter
    // Check if the range is different from the default [0, 30]
    const defaultBrixRange = DEFAULT_MAP_FILTERS.brixRange;
    if (filters.brixRange[0] !== defaultBrixRange[0] || filters.brixRange[1] !== defaultBrixRange[1]) {
        if (point.brixLevel < filters.brixRange[0] || point.brixLevel > filters.brixRange[1]) {
            return false;
        }
    }

    // Date range filter
    // Check if either start or end date is set and different from default empty string
    const defaultDateRange = DEFAULT_MAP_FILTERS.dateRange;
    if ((filters.dateRange[0] && filters.dateRange[0] !== defaultDateRange[0]) || (filters.dateRange[1] && filters.dateRange[1] !== defaultDateRange[1])) {
      const submittedDate = new Date(point.submittedAt);
      
      if (filters.dateRange[0]) {
        const startDate = new Date(filters.dateRange[0]);
        if (submittedDate < startDate) {
          return false;
        }
      }
      
      if (filters.dateRange[1]) {
        const endDate = new Date(filters.dateRange[1]);
        endDate.setUTCHours(23, 59, 59, 999); // End of day in UTC (timestamps are stored as UTC)
        if (submittedDate > endDate) {
          return false;
        }
      }
    }

    // Has image filter
    // Check if hasImage is true AND it's different from the default (false)
    if (filters.hasImage && filters.hasImage !== DEFAULT_MAP_FILTERS.hasImage && (!point.images || point.images.length === 0)) {
      return false;
    }

    // Submitted by filter
    // Check if submittedBy is set AND it's different from the default (empty string)
    if (filters.submittedBy && filters.submittedBy !== DEFAULT_MAP_FILTERS.submittedBy && !point.submittedBy.toLowerCase().includes(filters.submittedBy.toLowerCase())) {
      return false;
    }

    // Geographic location filters
    // City filter
    if (filters.city && filters.city !== DEFAULT_MAP_FILTERS.city) {
      if (point.city?.toLowerCase() !== filters.city.toLowerCase()) {
        return false;
      }
    }

    // State filter
    if (filters.state && filters.state !== DEFAULT_MAP_FILTERS.state) {
      if (point.state?.toLowerCase() !== filters.state.toLowerCase()) {
        return false;
      }
    }

    // Country filter
    if (filters.country && filters.country !== DEFAULT_MAP_FILTERS.country) {
      if (point.country?.toLowerCase() !== filters.country.toLowerCase()) {
        return false;
      }
    }

    return true;
  });

  return filtered;
}

/**
 * Returns the active filters as a list of discrete human-readable strings
 * (one entry per filter). `getFilterSummary` joins this same list, so the two
 * stay in lockstep — this exists so the UI can render each filter as its own
 * chip instead of one comma-joined sentence.
 */
export function getActiveFilterList(filters: MapFilter, isAdmin: boolean): string[] {
  const activeFilters: string[] = [];

  // Compare against DEFAULT_MAP_FILTERS for accuracy
  // Verified filter: only add if admin changed it OR if not admin (it's implicitly always true then)
  if (isAdmin && filters.verifiedOnly !== DEFAULT_MAP_FILTERS.verifiedOnly) {
    activeFilters.push(`verified: ${filters.verifiedOnly ? 'only' : 'any'}`);
  } else if (!isAdmin && DEFAULT_MAP_FILTERS.verifiedOnly) {
    activeFilters.push('Verified only'); // This means it's always applied for non-admins
  }
  
  if (filters.cropTypes.length > 0) {
    activeFilters.push(`${filters.cropTypes.length} crop type${filters.cropTypes.length > 1 ? 's' : ''}`);
  }
  
  if (filters.category && filters.category !== DEFAULT_MAP_FILTERS.category) {
    activeFilters.push(`category: ${filters.category}`);
  }
  
  // Brand filter - use user-friendly name
  if (filters.brand && filters.brand !== DEFAULT_MAP_FILTERS.brand) {
    activeFilters.push(`Brand/Farm: ${filters.brand}`);
  }
  
  // Place filter - use user-friendly name
  if (filters.place && filters.place !== DEFAULT_MAP_FILTERS.place) {
    activeFilters.push(`Point of Purchase: ${filters.place}`);
  }
  
  // Brix range: check if either bound is different from default
  if (filters.brixRange[0] !== DEFAULT_MAP_FILTERS.brixRange[0] || filters.brixRange[1] !== DEFAULT_MAP_FILTERS.brixRange[1]) {
    activeFilters.push(`BRIX: ${filters.brixRange[0].toFixed(1)}-${filters.brixRange[1].toFixed(1)}`);
  }
  
  // Date range: check if either start or end date is set and different from default
  if ((filters.dateRange[0] && filters.dateRange[0] !== DEFAULT_MAP_FILTERS.dateRange[0]) || (filters.dateRange[1] && filters.dateRange[1] !== DEFAULT_MAP_FILTERS.dateRange[1])) {
    const start = filters.dateRange[0] || 'start';
    const end = filters.dateRange[1] || 'end';
    activeFilters.push(`dates: ${start} to ${end}`);
  }
  
  if (filters.hasImage && filters.hasImage !== DEFAULT_MAP_FILTERS.hasImage) {
    activeFilters.push('with images');
  }
  
  if (filters.submittedBy && filters.submittedBy !== DEFAULT_MAP_FILTERS.submittedBy) {
    activeFilters.push(`by: ${filters.submittedBy}`);
  }

  // Geographic location filters
  const locationParts: string[] = [];
  if (filters.city && filters.city !== DEFAULT_MAP_FILTERS.city) {
    locationParts.push(filters.city);
  }
  if (filters.state && filters.state !== DEFAULT_MAP_FILTERS.state) {
    locationParts.push(filters.state);
  }
  if (filters.country && filters.country !== DEFAULT_MAP_FILTERS.country) {
    locationParts.push(filters.country);
  }
  if (locationParts.length > 0) {
    activeFilters.push(`location: ${locationParts.join(', ')}`);
  }

  return activeFilters;
}

export function getFilterSummary(filters: MapFilter, isAdmin: boolean): string {
  const activeFilters = getActiveFilterList(filters, isAdmin);
  return activeFilters.length > 0 ? activeFilters.join(', ') : 'No active filters';
}

/**
 * Active filters as structured entries, so each can be shown as a chip and
 * removed on its own.
 *
 * getActiveFilterList returns display strings, which is enough to say "these
 * filters are on" but not enough to undo one of them. `reset` is the patch that
 * clears just that filter, so a chip's dismiss is `setFilters(f => ({...f, ...reset}))`.
 *
 * Unlike getActiveFilterList this counts the free-text search, which is a
 * filter the user very much thinks they applied.
 */
export interface RemovableFilter {
  id: string;
  label: string;
  reset: Partial<MapFilter>;
}

export function getRemovableFilters(filters: MapFilter, isAdmin: boolean): RemovableFilter[] {
  const out: RemovableFilter[] = [];
  const D = DEFAULT_MAP_FILTERS;

  if (filters.search) {
    out.push({ id: 'search', label: `Search: ${filters.search}`, reset: { search: '' } });
  }
  if (filters.cropTypes.length > 0) {
    out.push({
      id: 'cropTypes',
      label: `${filters.cropTypes.length} crop type${filters.cropTypes.length > 1 ? 's' : ''}`,
      reset: { cropTypes: [] },
    });
  }
  if (filters.category && filters.category !== D.category) {
    out.push({ id: 'category', label: `Category: ${filters.category}`, reset: { category: '' } });
  }
  if (filters.brand && filters.brand !== D.brand) {
    out.push({ id: 'brand', label: `Brand: ${filters.brand}`, reset: { brand: '' } });
  }
  if (filters.place && filters.place !== D.place) {
    out.push({ id: 'place', label: `Place: ${filters.place}`, reset: { place: '' } });
  }
  if (filters.brixRange[0] !== D.brixRange[0] || filters.brixRange[1] !== D.brixRange[1]) {
    out.push({
      id: 'brixRange',
      label: `BRIX ${filters.brixRange[0].toFixed(1)}–${filters.brixRange[1].toFixed(1)}`,
      reset: { brixRange: [...D.brixRange] as [number, number] },
    });
  }
  if (filters.dateRange[0] || filters.dateRange[1]) {
    out.push({
      id: 'dateRange',
      label: `${filters.dateRange[0] || 'start'} → ${filters.dateRange[1] || 'end'}`,
      reset: { dateRange: [...D.dateRange] as [string, string] },
    });
  }
  if (filters.hasImage && filters.hasImage !== D.hasImage) {
    out.push({ id: 'hasImage', label: 'With images', reset: { hasImage: false } });
  }
  if (filters.timestamped && filters.timestamped !== D.timestamped) {
    out.push({ id: 'timestamped', label: 'On chain', reset: { timestamped: false } });
  }
  if (filters.submittedBy && filters.submittedBy !== D.submittedBy) {
    out.push({ id: 'submittedBy', label: `By: ${filters.submittedBy}`, reset: { submittedBy: '' } });
  }
  // Admins can turn the verified pin off; for everyone else it is not a choice,
  // so showing a chip they cannot act on would be noise.
  if (isAdmin && filters.verifiedOnly !== D.verifiedOnly) {
    out.push({ id: 'verifiedOnly', label: 'Including unverified', reset: { verifiedOnly: true } });
  }

  // One chip for the area: the three parts are chosen together in the
  // LocationSelector and clearing only the city would leave a stale state.
  const areaParts = [filters.city, filters.state, filters.country].filter(Boolean);
  if (areaParts.length > 0) {
    out.push({
      id: 'area',
      label: areaParts.join(', '),
      reset: { city: '', state: '', country: '' },
    });
  }

  return out;
}
