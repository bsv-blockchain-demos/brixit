/**
 * Display helpers for the admin engagement series.
 *
 * Kept out of the component so the date handling — the part with a real failure
 * mode — is testable without rendering a chart.
 */
import type { EngagementWeek } from './adminApi';

/**
 * Formats a `YYYY-MM-DD` week bucket as a short axis label.
 *
 * Parsed field-by-field rather than via `new Date(str)`: the bare-date form is
 * read as UTC midnight, so anywhere west of Greenwich it renders as the previous
 * day and every bar sits under the wrong week.
 */
export function formatWeekLabel(
  weekStart: string,
  opts?: { referenceYear?: number },
): string {
  const parts = weekStart.split('-');
  if (parts.length !== 3) return weekStart;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return weekStart;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return weekStart;
  // At "All" the axis can span years, where a bare "Sep 7" repeats and misleads.
  const reference = opts?.referenceYear ?? new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(y !== reference && { year: 'numeric' }),
  });
}

/** Sums one series across the visible range. */
export function totalFor(weeks: EngagementWeek[], key: 'new_users' | 'new_measurements'): number {
  return weeks.reduce((sum, w) => sum + (w[key] || 0), 0);
}

/**
 * Change between the latest complete week and the one before it.
 *
 * The newest bucket is the in-progress week and is always partial, so comparing
 * against it would report a decline every time. Returns null when there aren't
 * enough weeks, or when the earlier week was zero and a percentage would divide
 * by zero.
 */
export function weekOverWeekChange(
  weeks: EngagementWeek[],
  key: 'new_users' | 'new_measurements',
): number | null {
  if (weeks.length < 3) return null;
  const previous = weeks[weeks.length - 3][key];
  const latest = weeks[weeks.length - 2][key];
  if (!previous) return null;
  return Math.round(((latest - previous) / previous) * 100);
}

/**
 * Renders a conversion rate with the counts it came from, so the reader can
 * tell a strong signal from a tiny sample. A dash when nobody signed up.
 */
export function formatConversion(
  pct: number | null,
  converted: number,
  total: number,
): string {
  if (pct === null) return '—';
  return `${pct}% (${converted} of ${total})`;
}

/** Readings created before this date carry a created_at reconstructed by migration. */
export const READINGS_BACKFILL_DATE = '2026-09-14';

/** Same safe field-by-field parse as formatWeekLabel, but always with the year. */
export function formatFullDate(iso: string): string {
  return formatWeekLabel(iso, { referenceYear: 0 });
}
