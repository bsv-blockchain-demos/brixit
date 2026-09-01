import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '../formatDate';

// Fixed "now" so the boundaries are deterministic.
const NOW = new Date('2026-06-15T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatRelativeTime', () => {
  it('returns N/A for missing or unparseable input', () => {
    expect(formatRelativeTime(null, NOW)).toBe('N/A');
    expect(formatRelativeTime(undefined, NOW)).toBe('N/A');
    expect(formatRelativeTime('', NOW)).toBe('N/A');
    expect(formatRelativeTime('not a date', NOW)).toBe('N/A');
  });

  it('collapses the last minute to "just now"', () => {
    expect(formatRelativeTime(NOW, NOW)).toBe('just now');
    expect(formatRelativeTime(ago(44 * SEC), NOW)).toBe('just now');
  });

  it('reports minutes, never "0 min ago"', () => {
    expect(formatRelativeTime(ago(45 * SEC), NOW)).toBe('1 min ago');
    expect(formatRelativeTime(ago(MIN), NOW)).toBe('1 min ago');
    expect(formatRelativeTime(ago(59 * MIN), NOW)).toBe('59 min ago');
  });

  it('reports hours then days', () => {
    expect(formatRelativeTime(ago(HOUR), NOW)).toBe('1 hr ago');
    expect(formatRelativeTime(ago(2 * HOUR), NOW)).toBe('2 hr ago');
    expect(formatRelativeTime(ago(23 * HOUR), NOW)).toBe('23 hr ago');
    expect(formatRelativeTime(ago(DAY), NOW)).toBe('1 d ago');
    expect(formatRelativeTime(ago(5 * DAY), NOW)).toBe('5 d ago');
    expect(formatRelativeTime(ago(29 * DAY), NOW)).toBe('29 d ago');
  });

  it('reports months then years', () => {
    expect(formatRelativeTime(ago(30 * DAY), NOW)).toBe('1 mo ago');
    expect(formatRelativeTime(ago(200 * DAY), NOW)).toBe('6 mo ago');
    expect(formatRelativeTime(ago(400 * DAY), NOW)).toBe('1 yr ago');
  });

  it('falls back to an absolute date for future timestamps', () => {
    const future = new Date(NOW.getTime() + DAY);
    const out = formatRelativeTime(future, NOW);
    expect(out).not.toContain('ago');
    expect(out).toBe(future.toLocaleDateString());
  });

  it('accepts ISO strings and epoch numbers', () => {
    expect(formatRelativeTime(ago(2 * HOUR).toISOString(), NOW)).toBe('2 hr ago');
    expect(formatRelativeTime(ago(2 * HOUR).getTime(), NOW)).toBe('2 hr ago');
  });
});
