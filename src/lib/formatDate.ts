// Date formatting — locale/geolocation based. Follows the user's device locale
// (e.g. US -> 6/19/2026, UK -> 19/06/2026), matching the native date inputs.

/**
 * Format a date using the user's locale. Accepts a Date, ISO string, or timestamp.
 * Returns 'N/A' for missing or unparseable input.
 */
export function formatHumanDate(input: string | number | Date | null | undefined): string {
  if (input === null || input === undefined || input === '') return 'N/A';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString();
}
