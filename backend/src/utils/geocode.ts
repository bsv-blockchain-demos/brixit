import { config } from '../config.js';

export interface LocationData {
  country: string;
  state: string;
  city: string;
}

/**
 * Reverse-geocode lat/lng using GeoNames API.
 * Ported from supabase/functions/wallet-auth-verify/index.ts
 */
export async function reverseGeocode(lat: number, lng: number): Promise<LocationData> {
  const username = config.geonamesUsername;
  if (!username) {
    console.warn('[geocode] No GEONAMES_USERNAME configured');
    return { country: 'Unknown', state: '', city: '' };
  }

  try {
    const url = new URL('https://secure.geonames.org/findNearbyPlaceNameJSON');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lng', String(lng));
    url.searchParams.set('username', username);

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error('[geocode] GeoNames request failed:', response.status, await response.text());
      return { country: 'Unknown', state: '', city: '' };
    }

    const data = await response.json();
    if (data.geonames && data.geonames.length > 0) {
      const place = data.geonames[0];
      return {
        country: place.countryName || 'Unknown',
        state: place.adminName1 || '',
        city: place.name || '',
      };
    }

    return { country: 'Unknown', state: '', city: '' };
  } catch (err) {
    console.error('[geocode] Reverse geocode error:', err);
    return { country: 'Unknown', state: '', city: '' };
  }
}
