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
    it('returns excellent color for value at the excellent threshold', () => {
      expect(getBrixColor(16, asc)).toBe('bg-green-mid');
    });
    it('returns excellent color for value above excellent', () => {
      expect(getBrixColor(20, asc)).toBe('bg-green-mid');
    });
    it('returns good color for value at the good threshold', () => {
      expect(getBrixColor(12, asc)).toBe('bg-green-fresh');
    });
    it('returns good color for value between good and excellent', () => {
      expect(getBrixColor(14, asc)).toBe('bg-green-fresh');
    });
    it('returns average color for value at the average threshold', () => {
      expect(getBrixColor(8, asc)).toBe('bg-gold');
    });
    it('returns average color for value between average and good', () => {
      expect(getBrixColor(10, asc)).toBe('bg-gold');
    });
    it('returns poor color for value below average', () => {
      expect(getBrixColor(5, asc)).toBe('bg-score-poor');
    });
  });

  describe('ascending scale — hex mode', () => {
    it('returns excellent hex for excellent', () => {
      expect(getBrixColor(20, asc, 'hex')).toBe('#2d6a4f');
    });
    it('returns good hex for good', () => {
      expect(getBrixColor(14, asc, 'hex')).toBe('#40916c');
    });
    it('returns average hex for average', () => {
      expect(getBrixColor(10, asc, 'hex')).toBe('#c9a84c');
    });
    it('returns poor hex for poor', () => {
      expect(getBrixColor(1, asc, 'hex')).toBe('#c0392b');
    });
  });

  describe('descending scale — bg mode', () => {
    it('returns excellent color for value at or below excellent threshold', () => {
      expect(getBrixColor(8, desc)).toBe('bg-green-mid');
    });
    it('returns good color for value at the good threshold', () => {
      expect(getBrixColor(12, desc)).toBe('bg-green-fresh');
    });
    it('returns average color for value at the average threshold', () => {
      expect(getBrixColor(16, desc)).toBe('bg-gold');
    });
    it('returns poor color for value above average threshold', () => {
      expect(getBrixColor(22, desc)).toBe('bg-score-poor');
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
    expect(bgClass).toBe('bg-green-mid');
    expect(hex).toBe('#2d6a4f');
  });

  it('returns excellent colors for value above 1.75', () => {
    expect(rankColorFromNormalized(2.0).bgClass).toBe('bg-green-mid');
  });

  it('returns good colors for 1.5 <= value < 1.75', () => {
    const { bgClass, hex } = rankColorFromNormalized(1.5);
    expect(bgClass).toBe('bg-green-fresh');
    expect(hex).toBe('#40916c');
  });

  it('returns good colors mid-range', () => {
    expect(rankColorFromNormalized(1.6).bgClass).toBe('bg-green-fresh');
  });

  it('returns average colors for 1.25 <= value < 1.5', () => {
    const { bgClass, hex } = rankColorFromNormalized(1.25);
    expect(bgClass).toBe('bg-gold');
    expect(hex).toBe('#c9a84c');
  });

  it('returns average colors mid-range', () => {
    expect(rankColorFromNormalized(1.4).bgClass).toBe('bg-gold');
  });

  it('returns poor colors for value < 1.25', () => {
    const { bgClass, hex } = rankColorFromNormalized(1.0);
    expect(bgClass).toBe('bg-score-poor');
    expect(hex).toBe('#c0392b');
  });

  it('returns poor colors just below 1.25', () => {
    expect(rankColorFromNormalized(1.24).bgClass).toBe('bg-score-poor');
  });
});
