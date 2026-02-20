import { apiGet } from './api';

/**
 * Fetches unique crop categories.
 * @returns A promise that resolves to an array of category names.
 */
export async function fetchCropCategories(): Promise<string[]> {
  try {
    return await apiGet<string[]>('/api/crops/categories', { skipAuth: true });
  } catch (error) {
    console.error('Error fetching crop categories:', error);
    return [];
  }
}

/**
 * Fetches a single crop category by its unique name.
 * @param cropName The unique name of the crop.
 * @returns A promise that resolves to an object containing the category or null if not found.
 */
export async function fetchCropCategoryByName(cropName: string): Promise<{ category: string } | null> {
  try {
    const crop = await apiGet<{ category: string }>(`/api/crops/${encodeURIComponent(cropName)}`, { skipAuth: true });
    return { category: crop.category };
  } catch (error) {
    console.error('Error fetching crop by name:', error);
    return null;
  }
}