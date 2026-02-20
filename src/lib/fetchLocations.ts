import { apiGet } from './api';

export interface Location {
  id: string;
  name: string; // The unique identifier for the location.
  label: string; // The human-readable name for display.
}

/**
 * Fetches a list of locations from the database.
 * @returns {Promise<Location[]>} A promise that resolves to an array of Location objects.
 */
export const fetchLocations = async (): Promise<Location[]> => {
  return apiGet<Location[]>('/api/locations', { skipAuth: true });
};