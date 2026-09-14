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
export function formatWeekLabel(weekStart: string): string {
  const parts = weekStart.split('-');
  if (parts.length !== 3) return weekStart;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return weekStart;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return weekStart;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
