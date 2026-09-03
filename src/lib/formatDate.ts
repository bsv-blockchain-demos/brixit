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

/**
 * Compact "time ago" for table cells: "just now", "5 min ago", "2 hr ago",
 * "5 d ago", "3 mo ago", "2 yr ago".
 *
 * Falls back to the absolute date for anything in the future, which is what a
 * clock-skewed or mis-entered timestamp looks like, since "in -3 d ago" is
 * worse than simply showing the date.
 */
export function formatRelativeTime(
  input: string | number | Date | null | undefined,
  now: Date = new Date(),
): string {
  if (input === null || input === undefined || input === '') return 'N/A';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return 'N/A';

  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 0) return formatHumanDate(d);
  if (seconds < 45) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${Math.max(minutes, 1)} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;

  return `${Math.floor(months / 12)} yr ago`;
}
