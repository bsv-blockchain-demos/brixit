import { useCropThresholds } from '../contexts/CropThresholdContext';
import { BrixThresholds } from './getBrixQuality';

type ColorMode = 'bg' | 'hex';

const colorMap = {
  bg: {
    poor: 'bg-score-poor',
    average: 'bg-gold',
    good: 'bg-green-fresh',
    excellent: 'bg-green-mid',
    fallback: 'bg-gray-300',
  },
  hex: {
    poor: '#c0392b',
    average: '#c9a84c',
    good: '#40916c',
    excellent: '#2d6a4f',
    fallback: '#d1d5db',
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
    return mode === 'bg' ? 'bg-gray-300' : '#d1d5db';
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
  const quality: BrixScore['quality'] =
    normalized >= 1.75 ? 'Excellent' :
    normalized >= 1.5  ? 'Good' :
    normalized >= 1.25 ? 'Average' : 'Poor';
  return { normalized, display, bgClass, hex, quality };
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