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

export interface PeriodSplit {
  /** The selected period: the most recent complete weeks. */
  current: EngagementWeek[];
  /** The equal-length period immediately before it. Empty for all-time. */
  previous: EngagementWeek[];
  /** The in-progress week. Drawn on the chart, excluded from both totals. */
  partial: EngagementWeek | null;
}

/**
 * Split a series into the selected period and the one immediately before it.
 *
 * The series is expected to carry 2N complete weeks plus the in-progress week,
 * so the caller requests `2 * periodWeeks + 1`. The in-progress week is held out
 * of both periods: it is partial, and counting it would report a fall early in
 * every week. `periodWeeks` of null means all-time, which has nothing before it
 * to compare against.
 */
export function splitPeriods(
  weeks: EngagementWeek[],
  periodWeeks: number | null,
): PeriodSplit {
  const partial = weeks.length > 0 ? weeks[weeks.length - 1] : null;
  const complete = weeks.slice(0, -1);

  if (periodWeeks === null) return { current: complete, previous: [], partial };

  const current = complete.slice(-periodWeeks);
  const previous = complete.slice(Math.max(0, complete.length - periodWeeks * 2), complete.length - current.length);
  return { current, previous, partial };
}

export interface PeriodComparison {
  current: number;
  previous: number;
  /** Null when the comparison period was empty and a percentage is undefined. */
  changePct: number | null;
}

/** Totals for both periods, or null when there is nothing to compare against. */
export function comparePeriods(
  split: PeriodSplit,
  key: 'new_users' | 'new_measurements',
): PeriodComparison | null {
  if (split.previous.length === 0) return null;
  const current = totalFor(split.current, key);
  const previous = totalFor(split.previous, key);
  return {
    current,
    previous,
    changePct: previous ? Math.round(((current - previous) / previous) * 100) : null,
  };
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
