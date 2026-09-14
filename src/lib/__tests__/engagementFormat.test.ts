import { describe, it, expect } from 'vitest';
import { formatWeekLabel, totalFor, weekOverWeekChange } from '../engagementFormat';
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
