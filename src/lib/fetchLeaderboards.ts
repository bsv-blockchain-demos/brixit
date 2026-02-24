import { apiGet } from './api';

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

// Map old RPC names to backend leaderboard endpoints
const RPC_TO_ENDPOINT: Record<string, string> = {
  get_brand_leaderboard: '/api/leaderboards/brand',
  get_crop_leaderboard: '/api/leaderboards/crop',
  get_location_leaderboard: '/api/leaderboards/location',
  get_user_leaderboard_safe: '/api/leaderboards/user',
};

async function fetchLeaderboard<R extends LeaderboardEntry>(
  rpcName: string,
  filters: Filter = {}
): Promise<R[]> {
  const { city, state, country, crop } = filters;

  const endpoint = RPC_TO_ENDPOINT[rpcName] || `/api/leaderboards/${rpcName}`;

  const params = new URLSearchParams();
  if (country && country !== 'All countries') params.set('country', country);
  if (state && state !== 'All states') params.set('state', state);
  if (city && city !== 'All cities') params.set('city', city);
  if (crop) params.set('crop', crop);
  if (typeof filters.limit === 'number') params.set('limit', String(filters.limit));
  if (typeof filters.offset === 'number') params.set('offset', String(filters.offset));

  const qs = params.toString();
  const url = qs ? `${endpoint}?${qs}` : endpoint;

  try {
    const data = await apiGet<R[]>(url, { skipAuth: true });
    return Array.isArray(data) ? data : [];
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

