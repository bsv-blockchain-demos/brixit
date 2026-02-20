import { apiGet } from '@/lib/api';

/**
 * Fetches the GeoNames username from the Express backend.
 * @returns The GeoNames username or null if fetching fails.
 */
export async function getGeonamesUsername(): Promise<string | null> {
  try {
    const data = await apiGet<{ username: string }>('/api/geonames/username');
    return data.username ?? null;
  } catch (error) {
    console.error('Failed to fetch GeoNames username:', error);
    return null;
  }
}
