import { apiGet } from './api';

/**
 * Interface for a brand, including its unique name and human-readable label.
 */
export interface Brand {
  id: string;
  name: string; // This is the unique identifier from the database.
  label: string; // This is the human-readable display name.
}

/**
 * Fetches all brands from the database, ordering them by their human-readable label.
 * @returns A promise that resolves to an array of Brand objects.
 */
export const fetchBrands = async (): Promise<Brand[]> => {
  return apiGet<Brand[]>('/api/brands', { skipAuth: true });
};
