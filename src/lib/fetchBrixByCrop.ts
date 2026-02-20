import { apiGet } from './api';
import { Crop } from './fetchCropTypes';

/**
 * Fetches brix levels for a specific crop by its unique name.
 * @param cropName The unique name of the crop to fetch.
 * @returns A promise that resolves to a Crop object or null if not found.
 */
export async function fetchBrixByCrop(cropName: string): Promise<Crop | null> {
  try {
    const data = await apiGet<Crop>(`/api/crops/${encodeURIComponent(cropName.toLowerCase())}`, { skipAuth: true });
    return data;
  } catch (error) {
    console.error('Error fetching crop:', error);
    return null;
  }
}
