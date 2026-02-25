import { describe, it, expect } from 'vitest';
import { getBrixColor, computeNormalizedScore, rankColorFromNormalized } from '../getBrixColor';
import type { BrixThresholds } from '../getBrixQuality';

const asc: BrixThresholds = { poor: 4, average: 8, good: 12, excellent: 16 };
const desc: BrixThresholds = { poor: 20, average: 16, good: 12, excellent: 8 };

// ---------------------------------------------------------------------------
// getBrixColor
// ---------------------------------------------------------------------------
describe('getBrixColor', () => {
  describe('fallback cases', () => {
    it('returns bg fallback for null value', () => {
      expect(getBrixColor(null, asc)).toBe('bg-gray-300');
    });
    it('returns bg fallback for undefined value', () => {
      expect(getBrixColor(undefined, asc)).toBe('bg-gray-300');
    });
    it('returns bg fallback for NaN', () => {
      expect(getBrixColor(NaN, asc)).toBe('bg-gray-300');
    });
    it('returns bg fallback for undefined thresholds', () => {
      expect(getBrixColor(10, undefined)).toBe('bg-gray-300');
    });
    it('returns bg fallback when a threshold key is null', () => {
      expect(getBrixColor(10, { poor: 4, average: 8, good: null as any, excellent: 16 })).toBe('bg-gray-300');
    });
    it('returns bg fallback when a threshold key is NaN', () => {
      expect(getBrixColor(10, { poor: NaN, average: 8, good: 12, excellent: 16 })).toBe('bg-gray-300');
    });
    it('returns hex fallback in hex mode', () => {
      expect(getBrixColor(null, asc, 'hex')).toBe('#d1d5db');
    });
  });

  describe('ascending scale — bg mode (default)', () => {
    it('returns green for value at the excellent threshold', () => {
      expect(getBrixColor(16, asc)).toBe('bg-green-500');
    });
    it('returns green for value above excellent', () => {
      expect(getBrixColor(20, asc)).toBe('bg-green-500');
    });
    it('returns yellow for value at the good threshold', () => {
      expect(getBrixColor(12, asc)).toBe('bg-yellow-500');
    });
    it('returns yellow for value between good and excellent', () => {
      expect(getBrixColor(14, asc)).toBe('bg-yellow-500');
    });
    it('returns orange for value at the average threshold', () => {
      expect(getBrixColor(8, asc)).toBe('bg-orange-500');
    });
    it('returns orange for value between average and good', () => {
      expect(getBrixColor(10, asc)).toBe('bg-orange-500');
    });
    it('returns red for value below average', () => {
      expect(getBrixColor(5, asc)).toBe('bg-red-500');
    });
  });

  describe('ascending scale — hex mode', () => {
    it('returns green hex for excellent', () => {
      expect(getBrixColor(20, asc, 'hex')).toBe('#22c55e');
    });
    it('returns yellow hex for good', () => {
      expect(getBrixColor(14, asc, 'hex')).toBe('#eab308');
    });
    it('returns orange hex for average', () => {
      expect(getBrixColor(10, asc, 'hex')).toBe('#f97316');
    });
    it('returns red hex for poor', () => {
      expect(getBrixColor(1, asc, 'hex')).toBe('#ef4444');
    });
  });

  describe('descending scale — bg mode', () => {
    it('returns green for value at or below excellent threshold', () => {
      expect(getBrixColor(8, desc)).toBe('bg-green-500');
    });
    it('returns yellow for value at the good threshold', () => {
      expect(getBrixColor(12, desc)).toBe('bg-yellow-500');
    });
    it('returns orange for value at the average threshold', () => {
      expect(getBrixColor(16, desc)).toBe('bg-orange-500');
    });
    it('returns red for value above average threshold', () => {
      expect(getBrixColor(22, desc)).toBe('bg-red-500');
    });
  });
});

// ---------------------------------------------------------------------------
// computeNormalizedScore
// ---------------------------------------------------------------------------
describe('computeNormalizedScore', () => {
  const t: BrixThresholds = { poor: 0, average: 4, good: 8, excellent: 16 };

  it('returns 1.0 for a value equal to poor', () => {
    // (0 - 0) / (16 - 0) + 1 = 1.0
    expect(computeNormalizedScore(0, t)).toBeCloseTo(1.0);
  });

  it('returns 2.0 for a value equal to excellent', () => {
    // (16 - 0) / (16 - 0) + 1 = 2.0
    expect(computeNormalizedScore(16, t)).toBeCloseTo(2.0);
  });

  it('returns 1.5 for a value at the midpoint', () => {
    // (8 - 0) / (16 - 0) + 1 = 1.5
    expect(computeNormalizedScore(8, t)).toBeCloseTo(1.5);
  });

  it('falls back to min/max range when thresholds is null', () => {
    // (10 - 0) / (20 - 0) + 1 = 1.5
    expect(computeNormalizedScore(10, null, 0, 20)).toBeCloseTo(1.5);
  });

  it('falls back to min/max range when thresholds is undefined', () => {
    expect(computeNormalizedScore(10, undefined, 0, 20)).toBeCloseTo(1.5);
  });

  it('returns 1.5 when no thresholds and no fallback range are provided', () => {
    expect(computeNormalizedScore(10)).toBe(1.5);
  });

  it('returns 1.5 when excellent equals poor (avoids division by zero)', () => {
    const flat: BrixThresholds = { poor: 8, average: 8, good: 8, excellent: 8 };
    expect(computeNormalizedScore(8, flat)).toBe(1.5);
  });

  it('returns 1.5 when fallback max equals min (avoids division by zero)', () => {
    expect(computeNormalizedScore(10, undefined, 10, 10)).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------
// rankColorFromNormalized
// ---------------------------------------------------------------------------
describe('rankColorFromNormalized', () => {
  it('returns excellent colors for value >= 1.75', () => {
    const { bgClass, hex } = rankColorFromNormalized(1.75);
    expect(bgClass).toBe('bg-green-500');
    expect(hex).toBe('#22c55e');
  });

  it('returns excellent colors for value above 1.75', () => {
    expect(rankColorFromNormalized(2.0).bgClass).toBe('bg-green-500');
  });

  it('returns good colors for 1.5 <= value < 1.75', () => {
    const { bgClass, hex } = rankColorFromNormalized(1.5);
    expect(bgClass).toBe('bg-yellow-500');
    expect(hex).toBe('#eab308');
  });

  it('returns good colors mid-range', () => {
    expect(rankColorFromNormalized(1.6).bgClass).toBe('bg-yellow-500');
  });

  it('returns average colors for 1.25 <= value < 1.5', () => {
    const { bgClass, hex } = rankColorFromNormalized(1.25);
    expect(bgClass).toBe('bg-orange-500');
    expect(hex).toBe('#f97316');
  });

  it('returns average colors mid-range', () => {
    expect(rankColorFromNormalized(1.4).bgClass).toBe('bg-orange-500');
  });

  it('returns poor colors for value < 1.25', () => {
    const { bgClass, hex } = rankColorFromNormalized(1.0);
    expect(bgClass).toBe('bg-red-500');
    expect(hex).toBe('#ef4444');
  });

  it('returns poor colors just below 1.25', () => {
    expect(rankColorFromNormalized(1.24).bgClass).toBe('bg-red-500');
  });
});
