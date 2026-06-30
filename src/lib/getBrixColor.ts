import { useCropThresholds } from '../contexts/CropThresholdContext';
import { BrixThresholds } from './getBrixQuality';

type ColorMode = 'bg' | 'hex';

// Read a live CSS custom property so hex consumers (Leaflet markers, inline
// styles, charts) stay theme-correct and resolve to the SAME --score-* tokens
// the Tailwind bg classes use — one source of truth, no parallel palette.
const readVar = (name: string): string =>
  typeof window === 'undefined'
    ? ''
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const tierHex = (t: 'poor' | 'average' | 'good' | 'excellent'): string =>
  readVar(`--score-${t}`);

const colorMap = {
  bg: {
    poor: 'bg-score-poor',
    average: 'bg-score-average',
    good: 'bg-score-good',
    excellent: 'bg-score-excellent',
    fallback: 'bg-badge-neutral',
  },
  // Getters resolve at call time against the live theme.
  hex: {
    get poor() { return tierHex('poor'); },
    get average() { return tierHex('average'); },
    get good() { return tierHex('good'); },
    get excellent() { return tierHex('excellent'); },
    get fallback() { return readVar('--badge-neutral-bg') || '#d1d5db'; },
  },
};

/**
 * Gets a consistent color for a given value based on a set of thresholds.
 * The function is now robust and handles both ascending (Brix) and descending (Rank) scales.
 * @param value The numerical value (e.g., Brix level, normalized score, rank).
 * @param thresholds An object containing poor, average, good, and excellent threshold values.
 * @param mode Optional mode: 'bg' for Tailwind classes, 'hex' for hex colors. Default is 'bg'.
 * @returns A string representing the color.
 */
export function getBrixColor(
  value: number | null | undefined,
  thresholds: BrixThresholds | undefined,
  mode: ColorMode = 'bg'
): string {
  const colors = colorMap[mode];
  
  // Early return for invalid values
  if (value === null || value === undefined || isNaN(value)) {
    return colors.fallback;
  }
  
  // Enhanced validation for thresholds
  if (!thresholds) {
    return colors.fallback;
  }
  
  // Check if all required threshold properties exist and are numbers
  const requiredKeys = ['poor', 'average', 'good', 'excellent'] as const;
  const missingKeys = requiredKeys.filter(key => 
    thresholds[key] === null || 
    thresholds[key] === undefined || 
    typeof thresholds[key] !== 'number' || 
    isNaN(thresholds[key] as number)
  );
  
  if (missingKeys.length > 0) {
    return colors.fallback;
  }
  
  const { poor, average, good, excellent } = thresholds;
  
  // Determine if the scale is ascending (higher value is better, e.g., Brix)
  // or descending (lower value is better, e.g., Rank)
  const isAscending = excellent > poor;
  
  let selectedColor: string;
  
  if (isAscending) {
    // Ascending scale: higher values are better
    if (value >= excellent) {
      selectedColor = colors.excellent;
    } else if (value >= good) {
      selectedColor = colors.good;
    } else if (value >= average) {
      selectedColor = colors.average;
    } else {
      selectedColor = colors.poor;
    }
  } else {
    // Descending scale: lower values are better
    if (value <= excellent) {
      selectedColor = colors.excellent;
    } else if (value <= good) {
      selectedColor = colors.good;
    } else if (value <= average) {
      selectedColor = colors.average;
    } else {
      selectedColor = colors.poor;
    }
  }
  
  return selectedColor;
}

export function useBrixColorFromContext(
  cropName: string,
  brixLevel: number,
  mode: 'bg' | 'hex' = 'bg'
): string {
  const { getThresholds, loading } = useCropThresholds();

  if (loading) {
    return mode === 'bg' ? 'bg-badge-neutral' : (readVar('--badge-neutral-bg') || '#d1d5db');
  }

  return getBrixColor(brixLevel, getThresholds(cropName), mode);
}

// Map normalized score (1..2 scale) to hex color and tailwind background class
export function rankColorFromNormalized(
  normalizedValue: number, // expected ~1.0..2.0
): { hex: string; bgClass: string } {
  // Match semantic buckets from colorMap
  if (normalizedValue >= 1.75) {
    return { hex: colorMap.hex.excellent, bgClass: colorMap.bg.excellent };
  }
  if (normalizedValue >= 1.5) {
    return { hex: colorMap.hex.good, bgClass: colorMap.bg.good };
  }
  if (normalizedValue >= 1.25) {
    return { hex: colorMap.hex.average, bgClass: colorMap.bg.average };
  }
  return { hex: colorMap.hex.poor, bgClass: colorMap.bg.poor };
}


/**
 * Convert a 1–2 normalized score to the 0–100 display scale.
 */
export function toDisplayScore(normalizedScore: number): string {
  const pct = Math.round((normalizedScore - 1) * 100);
  return pct > 100 ? '100%+' : `${pct}%`;
}

/** Map a normalized 1–2 score to its quality tier (same buckets as rankColorFromNormalized). */
export function tierFromNormalized(n: number): 'Excellent' | 'Good' | 'Average' | 'Poor' {
  if (n >= 1.75) return 'Excellent';
  if (n >= 1.5) return 'Good';
  if (n >= 1.25) return 'Average';
  return 'Poor';
}

export type BrixScore = {
  normalized: number;
  display: string;
  bgClass: string;
  hex: string;
  quality: 'Excellent' | 'Good' | 'Average' | 'Poor';
};

/**
 * Default entry point for scoring a BRIX reading.
 * Returns everything needed for display — destructure only what you need.
 */
export function scoreBrix(
  brix: number,
  thresholds?: BrixThresholds | null,
  fallbackMin?: number,
  fallbackMax?: number
): BrixScore {
  const normalized = computeNormalizedScore(brix, thresholds, fallbackMin, fallbackMax);
  const { bgClass, hex } = rankColorFromNormalized(normalized);
  const display = toDisplayScore(normalized);
  const quality: BrixScore['quality'] = tierFromNormalized(normalized);
  return { normalized, display, bgClass, hex, quality };
}

export type BrixGrade = {
  quality: 'Excellent' | 'Good' | 'Average' | 'Poor' | 'Unknown';
  bgClass: string;
  hex: string;
};

// Maps the threshold color bucket back to a quality label. Because both come
// from getBrixColor, the label and the color are guaranteed to agree.
const BG_TO_QUALITY: Record<string, BrixGrade['quality']> = {
  'bg-score-excellent': 'Excellent',
  'bg-score-good': 'Good',
  'bg-score-average': 'Average',
  'bg-score-poor': 'Poor',
};

/**
 * Grade an INDIVIDUAL BRIX reading against its crop's four thresholds.
 * Use this for per-submission badges/markers (quality + color, no %).
 * For aggregates/rankings use the normalized path (scoreBrix / rankColorFromNormalized).
 *
 * Below the poor threshold reads as Poor. Only genuinely invalid input
 * (missing/NaN brix, missing/invalid thresholds) reads as Unknown + neutral.
 */
export function gradeBrix(
  brix: number | null | undefined,
  thresholds: BrixThresholds | null | undefined,
): BrixGrade {
  const t = thresholds ?? undefined;
  const bgClass = getBrixColor(brix, t, 'bg');
  const hex = getBrixColor(brix, t, 'hex');
  const quality = BG_TO_QUALITY[bgClass] ?? 'Unknown';
  return { quality, bgClass, hex };
}

/**
 * Escape hatch for when you only need the raw 1–2 normalized number (e.g. computing averages).
 * Use scoreBrix() for anything display-related.
 */
export function computeNormalizedScore(
  brix: number,
  thresholds?: BrixThresholds | null,
  fallbackMin?: number,
  fallbackMax?: number
): number {
  // Piecewise through all four thresholds (poor→1.0, average→1.25, good→1.5,
  // excellent→1.75, →2.0 beyond) so the colour buckets match the crop's tiers.
  if (
    thresholds &&
    typeof thresholds.poor === 'number' &&
    typeof thresholds.average === 'number' &&
    typeof thresholds.good === 'number' &&
    typeof thresholds.excellent === 'number' &&
    thresholds.poor < thresholds.average &&
    thresholds.average < thresholds.good &&
    thresholds.good < thresholds.excellent
  ) {
    const { poor, average, good, excellent } = thresholds;
    if (brix <= poor) return 1.0;
    if (brix <= average) return 1.0 + ((brix - poor) / (average - poor)) * 0.25;
    if (brix <= good) return 1.25 + ((brix - average) / (good - average)) * 0.25;
    if (brix <= excellent) return 1.5 + ((brix - good) / (excellent - good)) * 0.25;
    // Beyond excellent: continue at the good→excellent slope, capped at 2.0.
    return Math.min(2.0, 1.75 + ((brix - excellent) / (excellent - good)) * 0.25);
  }

  // Fallback: linear poor→excellent when average/good are missing/non-monotonic.
  if (thresholds && typeof thresholds.poor === 'number' && typeof thresholds.excellent === 'number' && thresholds.excellent > thresholds.poor) {
    return (brix - thresholds.poor) / (thresholds.excellent - thresholds.poor) + 1;
  }

  // fallback using min/max brix across dataset (expects fallbackMin < fallbackMax)
  if (typeof fallbackMin === 'number' && typeof fallbackMax === 'number' && fallbackMax > fallbackMin) {
    return (brix - fallbackMin) / (fallbackMax - fallbackMin) + 1;
  }

  // final fallback mid score
  return 1.5;
}