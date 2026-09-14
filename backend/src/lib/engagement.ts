/**
 * Shaping helpers for the admin engagement series.
 *
 * The weekly buckets themselves are built in SQL (see the /api/admin/engagement
 * route) so empty weeks come back as zeroes rather than gaps. What's left here
 * is the request/response edge: clamping the requested range, and turning the
 * driver's bigint counts and Date bucket keys into plain JSON.
 */

export const DEFAULT_WEEKS = 12;
export const MIN_WEEKS = 1;
export const MAX_WEEKS = 52;

export interface EngagementWeek {
  week_start: string;
  new_users: number;
  new_measurements: number;
}

/** Clamps `?weeks=` to a sane range; anything unparseable falls back to the default. */
export function clampWeeks(raw: unknown): number {
  // Number('') is 0, which would clamp to one week instead of defaulting.
  if (raw === undefined || raw === null || raw === '') return DEFAULT_WEEKS;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_WEEKS;
  return Math.max(MIN_WEEKS, Math.min(Math.trunc(n), MAX_WEEKS));
}

/**
 * `count(*)` arrives as a bigint, which JSON.stringify refuses outright, and the
 * bucket key as a Date. Narrow both to the wire shape, keeping the bucket as a
 * plain YYYY-MM-DD date — the week it labels, not an instant.
 */
export function normalizeEngagementRows(rows: unknown[]): EngagementWeek[] {
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      week_start: toDateKey(r.week_start),
      new_users: toCount(r.new_users),
      new_measurements: toCount(r.new_measurements),
    };
  });
}

function toCount(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toDateKey(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? '').slice(0, 10);
}
