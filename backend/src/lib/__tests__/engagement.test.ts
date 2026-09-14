import { describe, it, expect } from 'vitest';
import {
  clampWeeks,
  normalizeEngagementRows,
  DEFAULT_WEEKS,
  MIN_WEEKS,
  MAX_WEEKS,
} from '../engagement.js';

describe('clampWeeks', () => {
  it('defaults when the param is absent or unparseable', () => {
    expect(clampWeeks(undefined)).toBe(DEFAULT_WEEKS);
    expect(clampWeeks('')).toBe(DEFAULT_WEEKS);
    expect(clampWeeks('abc')).toBe(DEFAULT_WEEKS);
    expect(clampWeeks(NaN)).toBe(DEFAULT_WEEKS);
  });

  it('accepts values inside the range', () => {
    expect(clampWeeks('4')).toBe(4);
    expect(clampWeeks(26)).toBe(26);
    expect(clampWeeks('52')).toBe(MAX_WEEKS);
  });

  it('clamps out-of-range values rather than rejecting them', () => {
    expect(clampWeeks(0)).toBe(MIN_WEEKS);
    expect(clampWeeks(-40)).toBe(MIN_WEEKS);
    expect(clampWeeks(9001)).toBe(MAX_WEEKS);
  });

  it('truncates fractional weeks', () => {
    expect(clampWeeks('12.9')).toBe(12);
  });
});

describe('normalizeEngagementRows', () => {
  it('converts bigint counts and Date buckets to JSON-safe values', () => {
    const rows = [
      {
        week_start: new Date('2026-09-07T00:00:00.000Z'),
        new_users: 3n,
        new_measurements: 17n,
      },
    ];

    expect(normalizeEngagementRows(rows)).toEqual([
      { week_start: '2026-09-07', new_users: 3, new_measurements: 17 },
    ]);
  });

  it('survives JSON.stringify, which throws on raw bigints', () => {
    const rows = [{ week_start: new Date('2026-09-07T00:00:00.000Z'), new_users: 1n, new_measurements: 2n }];
    expect(() => JSON.stringify(rows)).toThrow();
    expect(() => JSON.stringify(normalizeEngagementRows(rows))).not.toThrow();
  });

  it('keeps zero weeks in the series rather than dropping them', () => {
    const rows = [
      { week_start: new Date('2026-08-31T00:00:00.000Z'), new_users: 0n, new_measurements: 0n },
      { week_start: new Date('2026-09-07T00:00:00.000Z'), new_users: 2n, new_measurements: 5n },
    ];
    const out = normalizeEngagementRows(rows);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ week_start: '2026-08-31', new_users: 0, new_measurements: 0 });
  });

  it('handles string dates and numeric counts from other drivers', () => {
    const rows = [{ week_start: '2026-09-07T00:00:00.000Z', new_users: 4, new_measurements: '9' }];
    expect(normalizeEngagementRows(rows)).toEqual([
      { week_start: '2026-09-07', new_users: 4, new_measurements: 9 },
    ]);
  });

  it('coerces a missing count to zero instead of NaN', () => {
    const rows = [{ week_start: new Date('2026-09-07T00:00:00.000Z') }];
    expect(normalizeEngagementRows(rows)).toEqual([
      { week_start: '2026-09-07', new_users: 0, new_measurements: 0 },
    ]);
  });
});
