import { describe, it, expect } from 'vitest';
import {
  formatWeekLabel,
  totalFor,
  splitPeriods,
  comparePeriods,
  formatConversion,
} from '../engagementFormat';
import type { EngagementWeek } from '../adminApi';

function week(week_start: string, new_users: number, new_measurements: number): EngagementWeek {
  return { week_start, new_users, new_measurements };
}

describe('formatWeekLabel', () => {
  it('labels the bucket with its own calendar day', () => {
    // new Date('2026-09-07') is UTC midnight, so it formats as Sep 6 west of GMT.
    expect(formatWeekLabel('2026-09-07')).toContain('7');
    expect(formatWeekLabel('2026-01-05')).toContain('5');
  });

  it('does not shift across a month boundary', () => {
    const label = formatWeekLabel('2026-03-01');
    expect(label).toContain('1');
    expect(label).not.toContain('Feb');
  });

  it('returns the input unchanged when it is not a date key', () => {
    expect(formatWeekLabel('')).toBe('');
    expect(formatWeekLabel('not-a-date')).toBe('not-a-date');
    expect(formatWeekLabel('2026-09')).toBe('2026-09');
  });
});

describe('totalFor', () => {
  it('sums a series across the range', () => {
    const rows = [week('2026-08-31', 2, 10), week('2026-09-07', 3, 15)];
    expect(totalFor(rows, 'new_users')).toBe(5);
    expect(totalFor(rows, 'new_measurements')).toBe(25);
  });

  it('is zero for an empty range', () => {
    expect(totalFor([], 'new_users')).toBe(0);
  });
});

describe('formatConversion', () => {
  it('shows the percentage with the counts behind it', () => {
    // 50% reads very differently as 1-of-2 than as 500-of-1000.
    expect(formatConversion(33.3, 4, 12)).toBe('33.3% (4 of 12)');
  });

  it('renders a dash when nobody signed up in the window', () => {
    expect(formatConversion(null, 0, 0)).toBe('—');
  });

  it('shows a zero rate rather than a dash when signups exist', () => {
    expect(formatConversion(0, 0, 5)).toBe('0% (0 of 5)');
  });

  it('handles full conversion', () => {
    expect(formatConversion(100, 5, 5)).toBe('100% (5 of 5)');
  });
});

describe('formatWeekLabel across years', () => {
  it('omits the year for weeks in the reference year', () => {
    expect(formatWeekLabel('2026-09-07', { referenceYear: 2026 })).not.toContain('2026');
  });

  it('includes the year for weeks outside it', () => {
    // At "All" the range can span years, and "Sep 7" twice on one axis is a lie.
    expect(formatWeekLabel('2024-09-07', { referenceYear: 2026 })).toContain('2024');
  });

  it('still labels the day when the year is shown', () => {
    expect(formatWeekLabel('2024-09-07', { referenceYear: 2026 })).toContain('7');
  });
});

describe('splitPeriods', () => {
  // 9 buckets: 8 complete + the in-progress week last.
  const nine = Array.from({ length: 9 }, (_, i) => week(`w${i}`, i, i));

  it('takes the current period from the complete weeks, newest last', () => {
    const { current } = splitPeriods(nine, 4);
    expect(current.map((w) => w.week_start)).toEqual(['w4', 'w5', 'w6', 'w7']);
  });

  it('takes the comparison period immediately before it', () => {
    const { previous } = splitPeriods(nine, 4);
    expect(previous.map((w) => w.week_start)).toEqual(['w0', 'w1', 'w2', 'w3']);
  });

  it('never puts the in-progress week in either period', () => {
    const { current, previous, partial } = splitPeriods(nine, 4);
    expect(partial?.week_start).toBe('w8');
    expect([...current, ...previous].map((w) => w.week_start)).not.toContain('w8');
  });

  it('has no comparison period for the all-time range', () => {
    const { current, previous } = splitPeriods(nine, null);
    expect(previous).toEqual([]);
    expect(current).toHaveLength(8);
  });

  it('returns a short comparison period when history runs out', () => {
    // Six complete weeks cannot fill two four-week periods.
    const six = Array.from({ length: 7 }, (_, i) => week(`w${i}`, 1, 1));
    const { current, previous } = splitPeriods(six, 4);
    expect(current).toHaveLength(4);
    expect(previous).toHaveLength(2);
  });
});

describe('comparePeriods', () => {
  const rows = (vals: number[]) => vals.map((v, i) => week(`w${i}`, v, v));

  it('compares the two period totals', () => {
    // previous [10,10]=20, current [15,15]=30
    const split = splitPeriods(rows([10, 10, 15, 15, 0]), 2);
    expect(comparePeriods(split, 'new_measurements')).toEqual({
      current: 30,
      previous: 20,
      changePct: 50,
    });
  });

  it('reports a collapse in activity as a large negative', () => {
    const split = splitPeriods(rows([30, 5, 1, 0, 0]), 2);
    expect(comparePeriods(split, 'new_measurements')?.changePct).toBe(-97);
  });

  it('gives no percentage when the comparison period was empty', () => {
    const split = splitPeriods(rows([0, 0, 3, 4, 0]), 2);
    const c = comparePeriods(split, 'new_measurements');
    expect(c?.changePct).toBeNull();
    expect(c?.current).toBe(7);
  });

  it('returns null when there is no comparison period at all', () => {
    expect(comparePeriods(splitPeriods(rows([1, 2, 3]), null), 'new_measurements')).toBeNull();
  });
});
