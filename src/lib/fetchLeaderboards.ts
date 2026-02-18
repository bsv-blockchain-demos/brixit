import { supabase } from '../integrations/supabase/client';

export type Filter = {
  city?: string;
  state?: string;
  country?: string;
  crop?: string;
  locationName?: string;
  placeId?: string;
  limit?: number;
  offset?: number;
};

export interface LeaderboardEntry {
  [key: string]: any;
  average_normalized_score?: number;
  average_brix?: number;
  submission_count: number;
  rank: number;
  crop_name?: string;
  crop_label?: string;
  brand_name?: string;
  brand_label?: string;
  location_name?: string;
  crop_id?: string;
  brand_id?: string;
  location_id?: string;
  entity_type?: string;
  entity_id?: string;
  entity_name?: string;
}

async function fetchLeaderboard<R extends LeaderboardEntry>(
  rpcName: string,
  filters: Filter = {}
): Promise<R[]> {
  const { city, state, country, crop } = filters;
  console.log(`🔍 Fetching ${rpcName} with filters:`, { city, state, country, crop });

  // Sanitize filters - treat "All countries" and similar values as null
  const sanitizeFilter = (value?: string) => {
    if (!value || value === "All countries" || value === "All states" || value === "All cities") {
      return null;
    }
    return value;
  };

  const params = {
    country_filter: sanitizeFilter(country),
    state_filter: sanitizeFilter(state),
    city_filter: sanitizeFilter(city),
    crop_filter: sanitizeFilter(crop),
    limit_count: typeof filters.limit === 'number' ? filters.limit : 50,
    offset_count: typeof filters.offset === 'number' ? filters.offset : 0,
  };

  try {
    const { data, error } = await (supabase as any).rpc(rpcName as any, params as any);
    
    if (error) {
      console.error(`❌ Error fetching ${rpcName}:`, error);
      throw error;
    }

    if (Array.isArray(data)) {
      return data.map((item) => {
        // normalize numeric fields
        ['average_normalized_score', 'average_brix', 'submission_count', 'rank'].forEach(field => {
          if (item[field] !== null && item[field] !== undefined) {
            const val = Number(item[field]);
            item[field] = isNaN(val) ? 0 : val;
          }
        });
        return item;
      });
    } else {
      console.warn(`⚠️ ${rpcName} returned non-array data:`, data);
      return [];
    }
  } catch (error) {
    console.error(`❌ Exception in fetchLeaderboard for ${rpcName}:`, error);
    return [];
  }
}

export async function fetchBrandLeaderboard(filters: Filter = {}) {
  return await fetchLeaderboard('get_brand_leaderboard', filters);
}

export async function fetchCropLeaderboard(filters: Filter = {}) {
  return await fetchLeaderboard('get_crop_leaderboard', filters);
}

export async function fetchLocationLeaderboard(filters: Filter = {}) {
  return await fetchLeaderboard('get_location_leaderboard', filters);
}

export async function fetchUserLeaderboard(filters: Filter = {}) {
  return await fetchLeaderboard('get_user_leaderboard_safe', filters);
}

// Utility function for debugging in browser console
if (typeof window !== 'undefined') {
  (window as any).fetchBrandLeaderboard = fetchBrandLeaderboard;
  (window as any).fetchCropLeaderboard = fetchCropLeaderboard;
  (window as any).fetchLocationLeaderboard = fetchLocationLeaderboard;
  (window as any).fetchUserLeaderboard = fetchUserLeaderboard;
}