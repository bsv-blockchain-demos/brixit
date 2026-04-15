import { useCropThresholds } from '../contexts/CropThresholdContext';
import { BrixThresholds } from './getBrixQuality';

type ColorMode = 'bg' | 'hex';

const colorMap = {
  bg: {
    poor: 'bg-score-poor',
    average: 'bg-gold',
    good: 'bg-gold',
    excellent: 'bg-green-mid',
    fallback: 'bg-gray-300',
  },
  hex: {
    poor: '#c0392b',
    average: '#c9a84c',
    good: '#c9a84c',
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
  const { cache, loading } = useCropThresholds();
  
  if (loading) {
    return mode === 'bg' ? 'bg-gray-300' : '#d1d5db';
  }

  const normalizedCropName = cropName.toLowerCase().trim();
  const thresholds = cache?.[normalizedCropName];

  return getBrixColor(brixLevel, thresholds, mode);
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
 * Compute normalized score for a reading given thresholds
 * This is exactly the same math you used on the map:
 *  score = (brix - poor) / (excellent - poor) + 1
 * If thresholds invalid, returns fallbackNormalized (e.g. using global min/max)
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