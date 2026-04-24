/**
 * Returns a deduplicated "city, state" string.
 * When city and state are identical (e.g. Zürich city inside Zürich canton),
 * state is omitted so "Zürich, Zürich" becomes "Zürich".
 */

export function formatCityState(
  city: string | null | undefined,
  state: string | null | undefined,
): string {
  const c = city?.trim() || '';
  const s = state?.trim() || '';
  if (!c && !s) return '';
  if (!c) return s;
  if (!s) return c;
  if (s.toLowerCase() === c.toLowerCase()) return c;
  return `${c}, ${s}`;
}

/**
 * Formats a venue location as "street, city" (or just city if no street).
 *
 * Mapbox sometimes returns a full address in street_address already containing
 * the city (e.g. "Albisstrasse 81, 8038 Zürich, Switzerland"). In that case the
 * city is NOT appended again — the street value is used as-is.
 *
 * When street_address is a bare street ("Augustinergasse 12"), city/state are
 * appended normally.
 */
export function formatVenueLocation(
  street: string | null | undefined,
  city: string | null | undefined,
  state: string | null | undefined,
): string {
  const s = street?.trim() || '';
  const cityState = formatCityState(city, state);

  if (!s) return cityState;

  // If the street string already contains the city token, avoid repeating it.
  const cityToken = cityState.split(',')[0].trim().toLowerCase();
  if (cityToken && s.toLowerCase().includes(cityToken)) return s;

  return cityState ? `${s}, ${cityState}` : s;
}

// Countries where the state/province is the preferred geographic suffix instead of the country name.
const STATE_PREFERRED_COUNTRIES = new Set([
  'united states', 'united states of america', 'us', 'usa',
  'canada', 'ca',
  'australia', 'au',
]);

/**
 * Formats a full venue location including country, with two special rules:
 *
 * 1. If the location string from formatVenueLocation already contains the
 *    country (e.g. Mapbox full_address "…, Switzerland"), it is not appended
 *    again.
 *
 * 2. For countries where the state is the useful geographic identifier (US,
 *    Canada, Australia), the country name is omitted because the state already
 *    in the string is more informative than "United States" etc.
 */
export function formatFullLocation(
  street: string | null | undefined,
  city: string | null | undefined,
  state: string | null | undefined,
  country: string | null | undefined,
): string {
  const loc = formatVenueLocation(street, city, state);
  const c = country?.trim() || '';

  if (!c) return loc;
  if (!loc) return c;

  if (loc.toLowerCase().includes(c.toLowerCase())) return loc;

  if (STATE_PREFERRED_COUNTRIES.has(c.toLowerCase())) return loc;

  return `${loc}, ${c}`;
}
