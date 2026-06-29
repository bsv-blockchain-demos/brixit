type Tier = 'Poor' | 'Average' | 'Good' | 'Excellent';

// Label text matches the Admin crops strip exactly so mode="threshold" renders identically.
const TIERS: { tier: Tier; label: string; bg: string; ink?: boolean }[] = [
  { tier: 'Poor',      label: 'Poor',      bg: 'bg-score-poor' },
  { tier: 'Average',   label: 'Avg',       bg: 'bg-score-average', ink: true },
  { tier: 'Good',      label: 'Good',      bg: 'bg-score-good' },
  { tier: 'Excellent', label: 'Excellent', bg: 'bg-score-excellent' },
];

const fmt = (n: number | null | undefined): string =>
  typeof n === 'number' && !isNaN(n) ? `${n}` : '-';

interface ScoreThresholdBarProps {
  poor: number | null | undefined;
  average: number | null | undefined;
  good: number | null | undefined;
  excellent: number | null | undefined;
  mode?: 'range' | 'threshold';
  activeTier?: Tier | 'Unknown';
  className?: string;
}

/**
 * Crop score thresholds as a strip of connected, color-coded tier chips.
 * - mode="threshold": each chip shows the tier's floor value (Admin crops look).
 * - mode="range": each chip shows the tier's band (poor–average, …, excellent+) —
 *   clearer for end users in the submission detail modal.
 * When activeTier matches a real tier, that chip grows (larger, bold) and the
 * others dim — so the reading's tier stands out. With no activeTier (e.g. admin
 * threshold mode) every chip renders at the base size, unchanged.
 */
export function ScoreThresholdBar({
  poor, average, good, excellent, mode = 'range', activeTier, className = '',
}: ScoreThresholdBarProps) {
  const valueByTier: Record<Tier, string> =
    mode === 'range'
      ? {
          Poor: `${fmt(poor)}–${fmt(average)}`,
          Average: `${fmt(average)}–${fmt(good)}`,
          Good: `${fmt(good)}–${fmt(excellent)}`,
          Excellent: `${fmt(excellent)}+`,
        }
      : {
          Poor: fmt(poor),
          Average: fmt(average),
          Good: fmt(good),
          Excellent: fmt(excellent),
        };

  // Only emphasize when activeTier names a real tier; otherwise keep the base
  // strip (admin threshold mode renders identically to before).
  const hasActive = TIERS.some((t) => t.tier === activeTier);

  return (
    <div className={`flex items-stretch gap-px rounded-md overflow-hidden w-fit ${className}`}>
      {TIERS.map((t) => {
        const isActive = hasActive && activeTier === t.tier;
        const dim = hasActive && !isActive;
        return (
          <span
            key={t.tier}
            className={[
              'flex flex-col items-center justify-center transition-all',
              t.bg,
              t.ink ? 'text-text-dark' : 'text-white',
              isActive ? 'min-w-[3.5rem] px-3 py-1.5 z-10' : 'min-w-[3rem] px-2 py-1',
              dim ? 'opacity-55' : '',
            ].join(' ')}
          >
            <span className={`leading-none uppercase tracking-wide opacity-90 ${isActive ? 'text-[10px]' : 'text-[9px]'}`}>
              {t.label}
            </span>
            <span className={`font-mono leading-tight ${isActive ? 'text-sm font-bold' : 'text-xs'}`}>
              {valueByTier[t.tier]}
            </span>
          </span>
        );
      })}
    </div>
  );
}
