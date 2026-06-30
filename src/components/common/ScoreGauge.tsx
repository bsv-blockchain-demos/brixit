import type { BrixThresholds } from '../../lib/getBrixQuality';
import { tierFromNormalized } from '../../lib/getBrixColor';

type TierName = 'Poor' | 'Average' | 'Good' | 'Excellent';

// Tier fill + readable pill-text colour, all tokenised.
const TIER: Record<TierName, { fill: string; text: string }> = {
  Poor:      { fill: 'var(--score-poor)',      text: 'var(--score-poor)' },
  Average:   { fill: 'var(--score-average)',   text: 'var(--score-average-text)' },
  Good:      { fill: 'var(--score-good)',      text: 'var(--score-good-text)' },
  Excellent: { fill: 'var(--score-excellent)', text: 'var(--score-excellent)' },
};

interface Props {
  /** Individual mode: the crop's thresholds + the reading value + its gradeBrix quality. */
  thresholds?: BrixThresholds | null;
  value?: number | null;
  quality?: string;
  /** Aggregate mode: a normalized 1–2 score. When set, quality + bar are derived from it. */
  normalizedScore?: number;
  className?: string;
}

/**
 * Compact BRIX score: a soft tier pill plus a quiet fill bar. Never shows a number.
 * - Individual: plots `value` on the crop's own threshold scale.
 * - Aggregate: plots `normalizedScore` (1–2) on the 0–100 scale.
 */
export function ScoreGauge({ thresholds, value, quality, normalizedScore, className = '' }: Props) {
  let q: string;
  let pos = 0;
  let valid: boolean;

  if (typeof normalizedScore === 'number' && !isNaN(normalizedScore)) {
    q = tierFromNormalized(normalizedScore);
    pos = Math.max(0, Math.min(100, (normalizedScore - 1) * 100));
    valid = true;
  } else {
    const poor = thresholds?.poor, average = thresholds?.average, good = thresholds?.good, excellent = thresholds?.excellent;
    q = quality ?? 'Average';
    valid =
      typeof value === 'number' &&
      [poor, average, good, excellent].every((n) => typeof n === 'number') &&
      (excellent as number) > (poor as number) &&
      TIER[q as TierName] != null;
    if (valid) {
      const cap = (excellent as number) + Math.max((excellent as number) - (good as number), 1);
      const dMin = poor as number;
      pos = Math.max(0, Math.min(100, (((value as number) - dMin) / (cap - dMin)) * 100));
    }
  }

  const tier = TIER[q as TierName] ?? TIER.Average;

  return (
    <div className={`w-[88px] text-center ${className}`}>
      <span
        className="inline-flex items-center justify-center min-w-[72px] px-2.5 py-0.5 rounded-full text-2xs font-bold whitespace-nowrap"
        style={{ background: `color-mix(in srgb, ${tier.fill} 16%, hsl(var(--card)))`, color: tier.text }}
      >
        {q}
      </span>
      {valid && (
        <div
          className="relative h-1.5 rounded-full mt-1.5"
          style={{ background: 'color-mix(in srgb, var(--text-muted) 16%, transparent)' }}
        >
          <div className="absolute left-0 inset-y-0 rounded-full" style={{ width: `${pos}%`, background: tier.fill }} />
          <div
            className="absolute top-1/2 w-3 h-3 rounded-full -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos}%`, background: tier.fill, boxShadow: '0 0 0 2px hsl(var(--card))' }}
          />
        </div>
      )}
    </div>
  );
}
