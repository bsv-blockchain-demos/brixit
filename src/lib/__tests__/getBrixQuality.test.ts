import { describe, it, expect } from 'vitest';
import { getBrixQuality } from '../getBrixQuality';
import type { BrixThresholds } from '../getBrixQuality';

// Ascending: higher value is better (typical BRIX scale)
const asc: BrixThresholds = { poor: 4, average: 8, good: 12, excellent: 16 };

// Descending: lower value is better (e.g. rank-based scale)
const desc: BrixThresholds = { poor: 20, average: 16, good: 12, excellent: 8 };

describe('getBrixQuality', () => {
  describe('guard clauses', () => {
    it('returns Unknown for null', () => {
      expect(getBrixQuality(null, asc)).toBe('Unknown');
    });
    it('returns Unknown for undefined', () => {
      expect(getBrixQuality(undefined, asc)).toBe('Unknown');
    });
    it('returns Unknown for NaN', () => {
      expect(getBrixQuality(NaN, asc)).toBe('Unknown');
    });
    it('returns Unknown when thresholds are undefined', () => {
      expect(getBrixQuality(10, undefined)).toBe('Unknown');
    });
  });

  describe('ascending scale (higher = better)', () => {
    it('returns Excellent at the excellent threshold', () => {
      expect(getBrixQuality(16, asc)).toBe('Excellent');
    });
    it('returns Excellent above the excellent threshold', () => {
      expect(getBrixQuality(20, asc)).toBe('Excellent');
    });
    it('returns Good just below excellent', () => {
      expect(getBrixQuality(15, asc)).toBe('Good');
    });
    it('returns Good at the good threshold', () => {
      expect(getBrixQuality(12, asc)).toBe('Good');
    });
    it('returns Average just below good', () => {
      expect(getBrixQuality(9, asc)).toBe('Average');
    });
    it('returns Average at the average threshold', () => {
      expect(getBrixQuality(8, asc)).toBe('Average');
    });
    it('returns Poor just below average', () => {
      expect(getBrixQuality(6, asc)).toBe('Poor');
    });
    it('returns Poor at the poor threshold', () => {
      expect(getBrixQuality(4, asc)).toBe('Poor');
    });
    it('returns Unknown for a value below the poor threshold', () => {
      expect(getBrixQuality(2, asc)).toBe('Unknown');
    });
  });

  describe('descending scale (lower = better)', () => {
    it('returns Excellent at or below the excellent threshold', () => {
      expect(getBrixQuality(8, desc)).toBe('Excellent');
    });
    it('returns Excellent below the excellent threshold', () => {
      expect(getBrixQuality(4, desc)).toBe('Excellent');
    });
    it('returns Good just above excellent', () => {
      expect(getBrixQuality(10, desc)).toBe('Good');
    });
    it('returns Good at the good threshold', () => {
      expect(getBrixQuality(12, desc)).toBe('Good');
    });
    it('returns Average just above good', () => {
      expect(getBrixQuality(14, desc)).toBe('Average');
    });
    it('returns Average at the average threshold', () => {
      expect(getBrixQuality(16, desc)).toBe('Average');
    });
    it('returns Poor just above average', () => {
      expect(getBrixQuality(18, desc)).toBe('Poor');
    });
    it('returns Poor at the poor threshold', () => {
      expect(getBrixQuality(20, desc)).toBe('Poor');
    });
    it('returns Unknown for a value above the poor threshold', () => {
      expect(getBrixQuality(25, desc)).toBe('Unknown');
    });
  });
});
