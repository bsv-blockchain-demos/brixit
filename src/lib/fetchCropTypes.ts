import { apiGet } from './api';
import { BrixThresholds } from './getBrixQuality';

export interface CropType {
  id: string;
  name: string;
  label: string | null;
}

/**
 * Interface for a crop, including its unique name, human-readable label, and brix levels.
 */
export interface Crop {
  id: string;
  name: string;
  label: string | null;
  brixLevels: BrixThresholds;
}

/**
 * Fetches all crop types, including their unique name and human-readable label.
 * @returns A promise that resolves to an array of CropType objects.
 */
export const fetchCropTypes = async (): Promise<CropType[]> => {
  return apiGet<CropType[]>('/api/crops', { skipAuth: true });
};
