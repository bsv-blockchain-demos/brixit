import { describe, it, expect } from 'vitest';
import { formatWeekLabel, totalFor, weekOverWeekChange, formatConversion } from '../engagementFormat';
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

describe('weekOverWeekChange', () => {
  it('compares the last two complete weeks, ignoring the partial current one', () => {
    const rows = [
      week('2026-08-24', 10, 0),
      week('2026-08-31', 10, 0), // previous complete
      week('2026-09-07', 15, 0), // latest complete
      week('2026-09-14', 1, 0),  // current, still in progress
    ];
    expect(weekOverWeekChange(rows, 'new_users')).toBe(50);
  });

  it('reports a decline as a negative percentage', () => {
    const rows = [week('a', 0, 0), week('b', 20, 0), week('c', 15, 0), week('d', 2, 0)];
    expect(weekOverWeekChange(rows, 'new_users')).toBe(-25);
  });

  it('returns null rather than dividing by zero', () => {
    const rows = [week('a', 0, 0), week('b', 0, 0), week('c', 5, 0), week('d', 1, 0)];
    expect(weekOverWeekChange(rows, 'new_users')).toBeNull();
  });

  it('returns null when the range is too short to compare', () => {
    expect(weekOverWeekChange([], 'new_users')).toBeNull();
    expect(weekOverWeekChange([week('a', 1, 1), week('b', 2, 2)], 'new_users')).toBeNull();
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
