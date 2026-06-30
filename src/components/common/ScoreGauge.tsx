import type { BrixThresholds } from '../../lib/getBrixQuality';

type TierName = 'Poor' | 'Average' | 'Good' | 'Excellent';

// Tier fill + readable pill-text colour, all tokenised (same mapping as the
// detail-view spectrum). Poor uses the orange --score-poor (already decoupled
// from the danger red); amber/green use darker readable text tokens.
const TIER: Record<TierName, { fill: string; text: string }> = {
  Poor:      { fill: 'var(--score-poor)',      text: 'var(--score-poor)' },
  Average:   { fill: 'var(--score-average)',   text: 'var(--score-average-text)' },
  Good:      { fill: 'var(--score-good)',      text: 'var(--score-good-text)' },
  Excellent: { fill: 'var(--score-excellent)', text: 'var(--score-excellent)' },
};

interface Props {
  thresholds?: BrixThresholds | null;
  value: number | null | undefined;
  /** Active tier from gradeBrix, so the gauge matches the row's quality exactly. */
  quality: string;
  /** Extra classes on the root (e.g. `mx-auto` to centre in a table cell). */
  className?: string;
}

/**
 * Compact table form of the BRIX score: a soft tier pill plus a quiet fill gauge
 * that plots the reading on the row's OWN crop scale (data-driven, never
 * hardcoded). The full educational spectrum (zones, ticks, bubble) lives in the
 * detail view (RefractometerReading); this is the calm, scannable version.
 */
export function ScoreGauge({ thresholds, value, quality, className = '' }: Props) {
  const poor = thresholds?.poor, average = thresholds?.average, good = thresholds?.good, excellent = thresholds?.excellent;
  const valid =
    typeof value === 'number' &&
    [poor, average, good, excellent].every((n) => typeof n === 'number') &&
    (excellent as number) > (poor as number) &&
    TIER[quality as TierName] != null;

  const tier = TIER[quality as TierName] ?? TIER.Average;

  // position% = (value - scaleMin) / (scaleMax - scaleMin), clamped. The open-ended
  // top tier gets a display cap mirroring the previous tier's width.
  let pos = 0;
  if (valid) {
    const cap = (excellent as number) + Math.max((excellent as number) - (good as number), 1);
    const dMin = poor as number;
    pos = Math.max(0, Math.min(100, (((value as number) - dMin) / (cap - dMin)) * 100));
  }

  return (
    <div className={`w-[88px] text-center ${className}`}>
      <span
        className="inline-flex items-center justify-center min-w-[72px] px-2.5 py-0.5 rounded-full text-2xs font-bold whitespace-nowrap"
        style={{ background: `color-mix(in srgb, ${tier.fill} 16%, hsl(var(--card)))`, color: tier.text }}
      >
        {quality}
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
