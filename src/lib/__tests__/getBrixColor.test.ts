import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getBrixColor, computeNormalizedScore, rankColorFromNormalized, scoreBrix, gradeBrix, tierFromNormalized } from '../getBrixColor';
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
  // Piecewise: poor→1.0, average→1.25, good→1.5, excellent→1.75.
  const t: BrixThresholds = { poor: 0, average: 4, good: 8, excellent: 16 };

  it('anchors poor → 1.0 (0%)', () => {
    expect(computeNormalizedScore(0, t)).toBeCloseTo(1.0);
  });

  it('anchors average → 1.25 (25%)', () => {
    expect(computeNormalizedScore(4, t)).toBeCloseTo(1.25);
  });

  it('anchors good → 1.5 (50%)', () => {
    expect(computeNormalizedScore(8, t)).toBeCloseTo(1.5);
  });

  it('anchors excellent → 1.75 (75%), NOT 2.0', () => {
    expect(computeNormalizedScore(16, t)).toBeCloseTo(1.75);
  });

  it('interpolates linearly between poor and average', () => {
    // 1.0 + (2-0)/(4-0)*0.25 = 1.125
    expect(computeNormalizedScore(2, t)).toBeCloseTo(1.125);
  });

  it('interpolates linearly between good and excellent', () => {
    // 1.5 + (12-8)/(16-8)*0.25 = 1.625
    expect(computeNormalizedScore(12, t)).toBeCloseTo(1.625);
  });

  it('extrapolates beyond excellent above 1.75 (capped at 2.0)', () => {
    // 1.75 + (20-16)/(16-8)*0.25 = 1.875
    expect(computeNormalizedScore(20, t)).toBeCloseTo(1.875);
    // Far beyond excellent caps at 2.0 (100%+)
    expect(computeNormalizedScore(1000, t)).toBe(2.0);
  });

  it('clamps below poor to 1.0', () => {
    expect(computeNormalizedScore(-5, t)).toBe(1.0);
  });

  it('regression: a reading between average and good buckets as Average, not Good', () => {
    // apple-12 regression: linear gave 1.5 ("Good"); piecewise must keep it in
    // the Average band (1.25–1.5) so aggregate colour matches gradeBrix.
    const apple: BrixThresholds = { poor: 6, average: 10, good: 14, excellent: 18 };
    const n = computeNormalizedScore(12, apple);
    expect(n).toBeGreaterThanOrEqual(1.25);
    expect(n).toBeLessThan(1.5);
    expect(rankColorFromNormalized(n).bgClass).toBe('bg-score-average');
  });

  it('falls back to linear poor→excellent when average/good are missing (non-monotonic)', () => {
    // average/good zeroed → not strictly increasing → linear fallback.
    const partial: BrixThresholds = { poor: 0, average: 0, good: 0, excellent: 16 };
    // (8 - 0) / (16 - 0) + 1 = 1.5
    expect(computeNormalizedScore(8, partial)).toBeCloseTo(1.5);
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

// ---------------------------------------------------------------------------
// scoreBrix — quality label, color (hex/bgClass), and display must stay in
// lockstep. Consumers (data row, detail modal) MUST read color from this
// bundle and never re-derive it from a parallel quality→color map, or the
// badge label and the colored square can disagree (the 50% "Good label /
// gold square" bug).
// ---------------------------------------------------------------------------
describe('scoreBrix', () => {
  // poor=0, excellent=16 → normalized = brix/16 + 1.
  const t: BrixThresholds = { poor: 0, average: 4, good: 8, excellent: 16 };

  it('keeps quality, hex, and bgClass consistent at the Good boundary (50%)', () => {
    // brix 8 → normalized 1.5 → Good tier, displayed "50%".
    const s = scoreBrix(8, t);
    expect(s.quality).toBe('Good');
    expect(s.display).toBe('50%');
    expect(s.bgClass).toBe('bg-score-good');
    expect(s.hex).toBe(TOKEN.good);
  });

  it('quality matches the color tier across every bucket', () => {
    const cases: Array<[number, string, string, string]> = [
      [16, 'Excellent', 'bg-score-excellent', TOKEN.excellent], // normalized 2.0
      [10, 'Good',      'bg-score-good',      TOKEN.good],       // normalized 1.625
      [5,  'Average',   'bg-score-average',   TOKEN.average],    // normalized 1.3125
      [1,  'Poor',      'bg-score-poor',      TOKEN.poor],       // normalized 1.0625
    ];
    for (const [brix, quality, bgClass, hex] of cases) {
      const s = scoreBrix(brix, t);
      expect(s.quality).toBe(quality);
      expect(s.bgClass).toBe(bgClass);
      expect(s.hex).toBe(hex);
    }
  });
});

// ---------------------------------------------------------------------------
// gradeBrix — individual-submission grading. quality is DERIVED from the
// color bucket so label and color can never disagree. Below-poor => Poor;
// only invalid input => Unknown + neutral.
// ---------------------------------------------------------------------------
describe('gradeBrix', () => {
  const t: BrixThresholds = { poor: 4, average: 8, good: 12, excellent: 16 };

  it('grades excellent with matching label, class and hex', () => {
    expect(gradeBrix(16, t)).toEqual({ quality: 'Excellent', bgClass: 'bg-score-excellent', hex: TOKEN.excellent });
  });
  it('grades good', () => {
    expect(gradeBrix(13, t)).toEqual({ quality: 'Good', bgClass: 'bg-score-good', hex: TOKEN.good });
  });
  it('grades average', () => {
    expect(gradeBrix(9, t)).toEqual({ quality: 'Average', bgClass: 'bg-score-average', hex: TOKEN.average });
  });
  it('grades poor', () => {
    expect(gradeBrix(5, t)).toEqual({ quality: 'Poor', bgClass: 'bg-score-poor', hex: TOKEN.poor });
  });
  it('grades a below-poor reading as Poor, not Unknown', () => {
    const g = gradeBrix(1, t);
    expect(g.quality).toBe('Poor');
    expect(g.bgClass).toBe('bg-score-poor');
  });
  it('grades invalid brix as Unknown + neutral', () => {
    expect(gradeBrix(null, t)).toEqual({ quality: 'Unknown', bgClass: 'bg-badge-neutral', hex: '#d1d5db' });
  });
  it('grades missing thresholds as Unknown', () => {
    expect(gradeBrix(10, undefined).quality).toBe('Unknown');
    expect(gradeBrix(10, null).quality).toBe('Unknown');
  });
});

describe('tierFromNormalized', () => {
  it('maps each bucket including boundaries', () => {
    expect(tierFromNormalized(2.0)).toBe('Excellent');
    expect(tierFromNormalized(1.75)).toBe('Excellent');
    expect(tierFromNormalized(1.74)).toBe('Good');
    expect(tierFromNormalized(1.5)).toBe('Good');
    expect(tierFromNormalized(1.49)).toBe('Average');
    expect(tierFromNormalized(1.25)).toBe('Average');
    expect(tierFromNormalized(1.24)).toBe('Poor');
    expect(tierFromNormalized(1.0)).toBe('Poor');
  });
});
