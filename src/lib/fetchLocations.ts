import { apiGet } from './api';

export interface Location {
  id: string;
  name: string;
  label: string;
}

// Backed by the `venues` table on the server — "location" is the user-facing
// concept (store / market / farm name + address).
export const fetchLocations = async (): Promise<Location[]> => {
  return apiGet<Location[]>('/api/venues', { skipAuth: true });
};