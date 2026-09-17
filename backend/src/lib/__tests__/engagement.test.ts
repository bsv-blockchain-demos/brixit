import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  clampWeeks,
  parseRange,
  normalizeEngagementRows,
  conversionPct,
  normalizeWindowRows,
  splitGeoRows,
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

describe('conversionPct', () => {
  it('reports the share of signups that produced a reading', () => {
    expect(conversionPct(3, 12)).toBe(25);
  });

  it('rounds to one decimal', () => {
    expect(conversionPct(1, 3)).toBe(33.3);
  });

  it('is null when nobody signed up, rather than NaN', () => {
    // 0/0 would render as "NaN%" on the card.
    expect(conversionPct(0, 0)).toBeNull();
  });

  it('is 0 when signups produced no readings', () => {
    expect(conversionPct(0, 5)).toBe(0);
  });

  it('is 100 when every signup converted', () => {
    expect(conversionPct(5, 5)).toBe(100);
  });
});

describe('normalizeWindowRows', () => {
  const row = {
    days: 7,
    new_users: 4n,
    unique_contributors: 3n,
    repeat_contributors: 2n,
    median_readings: '5.00',
    converted: 1n,
  };

  it('converts bigint counts and numeric strings to numbers', () => {
    const [w] = normalizeWindowRows([row]);
    expect(w.new_users).toBe(4);
    expect(w.unique_contributors).toBe(3);
    expect(w.repeat_contributors).toBe(2);
    expect(w.median_readings_per_contributor).toBe(5);
  });

  it('keeps the converted count so the percentage can show its denominator', () => {
    expect(normalizeWindowRows([row])[0].converted_users).toBe(1);
  });

  it('derives the conversion percentage from converted over new users', () => {
    expect(normalizeWindowRows([row])[0].signup_conversion_pct).toBe(25);
  });

  it('survives JSON.stringify', () => {
    expect(() => JSON.stringify(normalizeWindowRows([row]))).not.toThrow();
  });

  it('keeps a window with no activity at zero', () => {
    const empty = { days: 90, new_users: 0n, unique_contributors: 0n, repeat_contributors: 0n, median_readings: '0', converted: 0n };
    const [w] = normalizeWindowRows([empty]);
    expect(w.unique_contributors).toBe(0);
    expect(w.signup_conversion_pct).toBeNull();
  });
});

describe('splitGeoRows', () => {
  const rows = [
    { basis: 'reading', country: 'US', state: 'CO', n: 12n },
    { basis: 'reading', country: 'US', state: 'CA', n: 3n },
    { basis: 'contributor', country: 'US', state: 'CO', n: 2n },
  ];

  it('separates readings-by-place from contributors-by-place', () => {
    const out = splitGeoRows(rows);
    expect(out.by_reading).toHaveLength(2);
    expect(out.by_contributor).toHaveLength(1);
    expect(out.by_reading[0]).toEqual({ country: 'US', state: 'CO', count: 12 });
  });

  it('returns empty arrays when there is no geography at all', () => {
    expect(splitGeoRows([])).toEqual({ by_reading: [], by_contributor: [] });
  });

  it('ignores an unrecognised basis rather than guessing', () => {
    expect(splitGeoRows([{ basis: 'nonsense', country: 'US', state: 'CO', n: 1n }])).toEqual({
      by_reading: [],
      by_contributor: [],
    });
  });
});

describe('parseRange', () => {
  it('reads "all" as an ungated range', () => {
    expect(parseRange('all')).toEqual({ all: true });
  });

  it('is case-insensitive about it', () => {
    expect(parseRange('ALL')).toEqual({ all: true });
  });

  it('reads a week count', () => {
    expect(parseRange('26')).toEqual({ all: false, weeks: 26 });
  });

  it('falls back to the default when absent or unparseable', () => {
    expect(parseRange(undefined)).toEqual({ all: false, weeks: DEFAULT_WEEKS });
    expect(parseRange('')).toEqual({ all: false, weeks: DEFAULT_WEEKS });
    expect(parseRange('banana')).toEqual({ all: false, weeks: DEFAULT_WEEKS });
  });

  it('clamps out-of-range week counts instead of trusting them', () => {
    expect(parseRange(0)).toEqual({ all: false, weeks: MIN_WEEKS });
    expect(parseRange(9001)).toEqual({ all: false, weeks: MAX_WEEKS });
  });
});

describe('normalizeWindowRows with driver-native types', () => {
  it('reads a Prisma Decimal median, which is what the database actually returns', () => {
    // round(...)::numeric comes back as a Decimal object, not a string. A string
    // fixture alone would pass while production rendered 0.
    const [w] = normalizeWindowRows([
      {
        days: 30,
        new_users: 4n,
        unique_contributors: 3n,
        repeat_contributors: 1n,
        median_readings: new Prisma.Decimal('1.50'),
        converted: 2n,
      },
    ]);
    expect(w.median_readings_per_contributor).toBe(1.5);
    expect(w.signup_conversion_pct).toBe(50);
  });
});
