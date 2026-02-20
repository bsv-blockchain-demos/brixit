/**
 * Sanitize a string input — strip control chars, SQL wildcards, script injection attempts.
 * Ported from supabase/functions/auto-verify-submission/index.ts
 */
export function sanitizeInput(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return (
    trimmed
      .replace(/[\u0000-\u001F\u007F<>`"'\\]/g, '')
      .replace(/[%_]/g, '')
      .replace(/(javascript:|data:)/gi, '')
      .replace(/\s{2,}/g, ' ') || null
  );
}

/**
 * Fix floating point precision to 6 decimal places.
 */
export function fixPrecision(num: number): number {
  return parseFloat(num.toFixed(6));
}

export interface ParsedAddress {
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

/**
 * Parse a comma-separated address string into components.
 */
export function parseAddressString(addressString: string): ParsedAddress {
  const parts = addressString.split(',').map((part) => part.trim());
  if (parts.length >= 4) {
    return {
      street_address: parts[0] || null,
      city: parts[1] || null,
      state: parts[2] || null,
      country: parts[3] || null,
    };
  } else if (parts.length === 3) {
    return {
      street_address: null,
      city: parts[0] || null,
      state: parts[1] || null,
      country: parts[2] || null,
    };
  }
  return { street_address: addressString };
}

export interface LocationLabelInput {
  store_name?: string | null;
  business_name?: string | null;
  poi_name?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  locationName?: string | null;
}

/**
 * Create a human-readable label from location data.
 */
export function createHumanReadableLabel(locationData: LocationLabelInput): string {
  const { store_name, business_name, poi_name, street_address, city, state, country, locationName } = locationData;
  if (store_name) return store_name;
  if (business_name) return business_name;
  if (poi_name) return poi_name;
  const addressParts: string[] = [];
  if (street_address && !street_address.includes(',')) {
    addressParts.push(street_address);
  }
  if (city) addressParts.push(city);
  if (state) addressParts.push(state);
  if (country && country !== 'United States') addressParts.push(country);
  if (addressParts.length > 0) {
    return addressParts.join(', ');
  }
  return locationName || 'Unknown Location';
}
