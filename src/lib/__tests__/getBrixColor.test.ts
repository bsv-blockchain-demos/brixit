import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getBrixColor, computeNormalizedScore, rankColorFromNormalized } from '../getBrixColor';
import type { BrixThresholds } from '../getBrixQuality';

const asc: BrixThresholds = { poor: 4, average: 8, good: 12, excellent: 16 };
const desc: BrixThresholds = { poor: 20, average: 16, good: 12, excellent: 8 };

// hex mode reads the live --score-* tokens (one source of truth shared with the
// Tailwind bg-score-* classes). The vitest env is node with no DOM, so stub the
// browser globals readVar() depends on and serve the :root token values.
const TOKEN = {
  excellent: '#1f6b3f',
  good: '#6fae3f',
  average: '#e1b12c',
  poor: '#c0392b',
};
const VARS: Record<string, string> = {
  '--score-excellent': TOKEN.excellent,
  '--score-good': TOKEN.good,
  '--score-average': TOKEN.average,
  '--score-poor': TOKEN.poor,
};
const g = globalThis as any;
const saved = { window: g.window, document: g.document, getComputedStyle: g.getComputedStyle };
beforeAll(() => {
  g.window = {};
  g.document = { documentElement: {} };
  g.getComputedStyle = () => ({ getPropertyValue: (name: string) => VARS[name] ?? '' });
});
afterAll(() => {
  g.window = saved.window;
  g.document = saved.document;
  g.getComputedStyle = saved.getComputedStyle;
});

// ---------------------------------------------------------------------------
// getBrixColor
// ---------------------------------------------------------------------------
describe('getBrixColor', () => {
  describe('fallback cases', () => {
    it('returns bg fallback for null value', () => {
      expect(getBrixColor(null, asc)).toBe('bg-badge-neutral');
    });
    it('returns bg fallback for undefined value', () => {
      expect(getBrixColor(undefined, asc)).toBe('bg-badge-neutral');
    });
    it('returns bg fallback for NaN', () => {
      expect(getBrixColor(NaN, asc)).toBe('bg-badge-neutral');
    });
    it('returns bg fallback for undefined thresholds', () => {
      expect(getBrixColor(10, undefined)).toBe('bg-badge-neutral');
    });
    it('returns bg fallback when a threshold key is null', () => {
      expect(getBrixColor(10, { poor: 4, average: 8, good: null as any, excellent: 16 })).toBe('bg-badge-neutral');
    });
    it('returns bg fallback when a threshold key is NaN', () => {
      expect(getBrixColor(10, { poor: NaN, average: 8, good: 12, excellent: 16 })).toBe('bg-badge-neutral');
    });
    it('returns hex fallback in hex mode', () => {
      // --badge-neutral-bg is unset in jsdom, so the literal fallback applies.
      expect(getBrixColor(null, asc, 'hex')).toBe('#d1d5db');
    });
  });

  describe('ascending scale — bg mode (default)', () => {
    it('returns excellent color for value at the excellent threshold', () => {
      expect(getBrixColor(16, asc)).toBe('bg-score-excellent');
    });
    it('returns excellent color for value above excellent', () => {
      expect(getBrixColor(20, asc)).toBe('bg-score-excellent');
    });
    it('returns good color for value at the good threshold', () => {
      expect(getBrixColor(12, asc)).toBe('bg-score-good');
    });
    it('returns good color for value between good and excellent', () => {
      expect(getBrixColor(14, asc)).toBe('bg-score-good');
    });
    it('returns average color for value at the average threshold', () => {
      expect(getBrixColor(8, asc)).toBe('bg-score-average');
    });
    it('returns average color for value between average and good', () => {
      expect(getBrixColor(10, asc)).toBe('bg-score-average');
    });
    it('returns poor color for value below average', () => {
      expect(getBrixColor(5, asc)).toBe('bg-score-poor');
    });
  });

  describe('ascending scale — hex mode', () => {
    it('returns excellent hex for excellent', () => {
      expect(getBrixColor(20, asc, 'hex')).toBe(TOKEN.excellent);
    });
    it('returns good hex for good', () => {
      expect(getBrixColor(14, asc, 'hex')).toBe(TOKEN.good);
    });
    it('returns average hex for average', () => {
      expect(getBrixColor(10, asc, 'hex')).toBe(TOKEN.average);
    });
    it('returns poor hex for poor', () => {
      expect(getBrixColor(1, asc, 'hex')).toBe(TOKEN.poor);
    });
  });

  describe('descending scale — bg mode', () => {
    it('returns excellent color for value at or below excellent threshold', () => {
      expect(getBrixColor(8, desc)).toBe('bg-score-excellent');
    });
    it('returns good color for value at the good threshold', () => {
      expect(getBrixColor(12, desc)).toBe('bg-score-good');
    });
    it('returns average color for value at the average threshold', () => {
      expect(getBrixColor(16, desc)).toBe('bg-score-average');
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
    expect(bgClass).toBe('bg-score-excellent');
    expect(hex).toBe(TOKEN.excellent);
  });

  it('returns excellent colors for value above 1.75', () => {
    expect(rankColorFromNormalized(2.0).bgClass).toBe('bg-score-excellent');
  });

  it('returns good colors for 1.5 <= value < 1.75', () => {
    const { bgClass, hex } = rankColorFromNormalized(1.5);
    expect(bgClass).toBe('bg-score-good');
    expect(hex).toBe(TOKEN.good);
  });

  it('returns good colors mid-range', () => {
    expect(rankColorFromNormalized(1.6).bgClass).toBe('bg-score-good');
  });

  it('returns average colors for 1.25 <= value < 1.5', () => {
    const { bgClass, hex } = rankColorFromNormalized(1.25);
    expect(bgClass).toBe('bg-score-average');
    expect(hex).toBe(TOKEN.average);
  });

  it('returns average colors mid-range', () => {
    expect(rankColorFromNormalized(1.4).bgClass).toBe('bg-score-average');
  });

  it('returns poor colors for value < 1.25', () => {
    const { bgClass, hex } = rankColorFromNormalized(1.0);
    expect(bgClass).toBe('bg-score-poor');
    expect(hex).toBe(TOKEN.poor);
  });

  it('returns poor colors just below 1.25', () => {
    expect(rankColorFromNormalized(1.24).bgClass).toBe('bg-score-poor');
  });
});
