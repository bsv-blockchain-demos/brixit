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

/** A selected time range: a week count, or every record ever. */
export type Range = { all: true } | { all: false; weeks: number };

/** Parses `?weeks=`, where the literal "all" means no time gate at all. */
export function parseRange(raw: unknown): Range {
  if (typeof raw === 'string' && raw.trim().toLowerCase() === 'all') return { all: true };
  return { all: false, weeks: clampWeeks(raw) };
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

// ─── Rolling-window summary ──────────────────────────────────────────────────

export interface EngagementWindow {
  days: number;
  /** Kept as the denominator behind signup_conversion_pct, not shown on its own. */
  new_users: number;
  unique_contributors: number;
  /** Contributors who submitted on more than one distinct day in the window. */
  repeat_contributors: number;
  median_readings_per_contributor: number;
  /** Users from this window's signups who have since submitted. */
  converted_users: number;
  /** Share of users created in the window who have since submitted. Null when none signed up. */
  signup_conversion_pct: number | null;
}

export interface GeoRow {
  country: string;
  state: string;
  count: number;
}

export interface CategoryRow {
  category: string;
  readings: number;
}

/** Percentage to one decimal, or null when the denominator is zero. */
export function conversionPct(converted: number, total: number): number | null {
  if (!total) return null;
  return Math.round((converted / total) * 1000) / 10;
}

export function normalizeWindowRows(rows: unknown[]): EngagementWindow[] {
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    const newUsers = toCount(r.new_users);
    return {
      days: toCount(r.days),
      new_users: newUsers,
      unique_contributors: toCount(r.unique_contributors),
      repeat_contributors: toCount(r.repeat_contributors),
      median_readings_per_contributor: toCount(r.median_readings),
      converted_users: toCount(r.converted),
      signup_conversion_pct: conversionPct(toCount(r.converted), newUsers),
    };
  });
}

/**
 * Split the geography rows into the two bases they carry: where readings were
 * taken (venue) and where contributors live (profile). An unknown basis is
 * dropped rather than guessed at.
 */
export function splitGeoRows(rows: unknown[]): { by_reading: GeoRow[]; by_contributor: GeoRow[] } {
  const out: { by_reading: GeoRow[]; by_contributor: GeoRow[] } = { by_reading: [], by_contributor: [] };
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const entry: GeoRow = {
      country: String(r.country ?? 'Unknown'),
      state: String(r.state ?? 'Unknown'),
      count: toCount(r.n),
    };
    if (r.basis === 'reading') out.by_reading.push(entry);
    else if (r.basis === 'contributor') out.by_contributor.push(entry);
  }
  return out;
}

export function normalizeCategoryRows(rows: unknown[]): CategoryRow[] {
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return { category: String(r.category ?? 'Uncategorised'), readings: toCount(r.readings) };
  });
}
