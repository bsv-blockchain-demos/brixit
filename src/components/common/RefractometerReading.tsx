import { FlaskConical, Leaf } from 'lucide-react';
import type { BrixThresholds } from '../../lib/getBrixQuality';

/**
 * Refractometer Reading hero (top of the submission detail card/modal).
 *
 * Everything is DATA-DRIVEN from the crop's configured thresholds — no hardcoded
 * BRIX numbers. The spectrum maps the value to a position on the crop's scale:
 * proportional tier zones (segment width = the tier's real BRIX span), boundary
 * ticks, and a value bubble + needle dropped on the exact position, coloured by
 * the active tier. All colours resolve to --score-* tokens.
 *
 * Two presentations: `desktop` (horizontal hero, legend on) and `mobile`
 * (stacked, centred, legend off, crop-name caption).
 */

type TierName = 'Poor' | 'Average' | 'Good' | 'Excellent';

// Per-tier colours, all tokenised. `text` is the readable hero-text colour for
// that tier (the segment fills are too light for text on the tinted zone).
const TIER_META: Record<TierName, { key: string; fill: string; text: string; ink?: boolean }> = {
  Poor:      { key: 'poor',      fill: 'var(--score-poor)',      text: 'var(--score-poor)' },
  Average:   { key: 'average',   fill: 'var(--score-average)',   text: 'var(--score-average-text)', ink: true },
  Good:      { key: 'good',      fill: 'var(--score-good)',      text: 'var(--score-good-text)' },
  Excellent: { key: 'excellent', fill: 'var(--score-excellent)', text: 'var(--score-excellent)' },
};

const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : `${Math.round(n * 10) / 10}`);
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

interface Props {
  thresholds?: BrixThresholds | null;
  value: number;
  cropName: string;
  /** Active tier from gradeBrix, so the hero matches the data-row badge exactly. */
  quality: string;
  variant: 'desktop' | 'mobile';
}

export function RefractometerReading({ thresholds, value, cropName, quality, variant }: Props) {
  const poor = thresholds?.poor, average = thresholds?.average, good = thresholds?.good, excellent = thresholds?.excellent;

  const scaleValid =
    [poor, average, good, excellent].every((n) => typeof n === 'number') &&
    (excellent as number) > (poor as number) &&
    TIER_META[quality as TierName] != null;

  // Open-ended top tier gets a display cap that mirrors the previous tier's width.
  const cap = scaleValid ? (excellent as number) + Math.max((excellent as number) - (good as number), 1) : 0;
  const tiers = scaleValid
    ? [
        { name: 'Poor' as TierName,      min: poor as number,      max: average as number },
        { name: 'Average' as TierName,   min: average as number,   max: good as number },
        { name: 'Good' as TierName,      min: good as number,      max: excellent as number },
        { name: 'Excellent' as TierName, min: excellent as number, max: cap, openLabel: `${fmt(excellent as number)}+` },
      ]
    : [];

  const domainMin = poor as number;
  const span = cap - domainMin;
  const posOf = (v: number) => clamp01((v - domainMin) / span) * 100;

  const meta = TIER_META[quality as TierName] ?? TIER_META.Average;
  const markerPos = scaleValid ? posOf(value) : 0;
  const bubbleInk = meta.ink ? 'var(--score-ink)' : '#fff';
  const zoneBg = `var(--score-${meta.key}-bg)`;
  const zoneBorder = `color-mix(in srgb, ${meta.fill} 32%, var(--hairline))`;

  const ticks = scaleValid
    ? [
        ...tiers.map((t) => ({ at: posOf(t.min), label: fmt(t.min) })),
        { at: 100, label: tiers[tiers.length - 1].openLabel as string },
      ]
    : [];

  const Spectrum = ({ legend }: { legend: boolean }) => (
    <div>
      {/* value bubble + needle, positioned at the exact reading */}
      <div className="relative h-[30px]">
        {/* Bubble shifts inward toward the edges (translateX scales with position) so it
            never clips off-track at the extremes, while the needle stays on the exact value. */}
        <div
          className="absolute top-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-xs font-bold whitespace-nowrap shadow-md"
          style={{ left: `${markerPos}%`, transform: `translateX(-${markerPos}%)`, background: meta.fill, color: bubbleInk }}
        >
          <span className="font-mono">{fmt(value)}</span>
          <span>· {quality}</span>
        </div>
        <div
          className="absolute top-[26px] w-0.5 h-2.5 -translate-x-1/2 rounded-full"
          style={{ left: `${markerPos}%`, background: meta.fill }}
        />
      </div>
      {/* track: tier zones flex-sized to each tier's real BRIX span (proportional) */}
      <div className="flex h-3.5 rounded-full overflow-hidden mt-1.5">
        {tiers.map((t) => (
          <div key={t.name} style={{ flexGrow: t.max - t.min, flexBasis: 0, background: TIER_META[t.name].fill }} />
        ))}
      </div>
      {/* boundary ticks at each tier's real position (edge ticks align inward) */}
      <div className="relative h-[13px] mt-2">
        {ticks.map((tk, i) => (
          <span
            key={i}
            className="absolute top-0 font-mono text-2xs text-text-muted whitespace-nowrap"
            style={{
              left: `${tk.at}%`,
              transform: i === 0 ? 'translateX(0)' : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {tk.label}
          </span>
        ))}
      </div>
      {legend && (
        <div className="flex justify-between mt-3">
          {tiers.map((t) => (
            <span key={t.name} className="flex items-center gap-1.5 text-xs font-semibold text-text-mid">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: TIER_META[t.name].fill }} />
              {t.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  // Fallback for an unconfigured/degenerate scale: number + quality, no spectrum.
  if (!scaleValid) {
    return (
      <div className="rounded-2xl border border-hairline bg-card shadow-sm p-5">
        <div className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-wider font-medium text-text-muted">
          <FlaskConical className="w-3.5 h-3.5" />
          Refractometer reading
        </div>
        <div className="flex items-baseline gap-1.5 mt-2 text-text-dark">
          <span className="font-display font-semibold text-4xl leading-none tabular-nums">{fmt(value)}</span>
          <span className="font-semibold text-xs uppercase tracking-wider opacity-80">BRIX</span>
        </div>
        <div className="font-display text-xl text-text-dark mt-1">{quality}</div>
      </div>
    );
  }

  if (variant === 'mobile') {
    return (
      <div className="p-4" style={{ background: zoneBg }}>
        <div className="flex justify-center items-center gap-1.5 font-mono text-2xs uppercase tracking-wider font-medium" style={{ color: meta.text }}>
          <FlaskConical className="w-3.5 h-3.5" />
          Refractometer reading
        </div>
        <div className="flex justify-center items-baseline gap-1.5 mt-2 mb-3.5" style={{ color: meta.text }}>
          <span className="font-display font-semibold text-4xl leading-none tabular-nums">{fmt(value)}</span>
          <span className="font-semibold text-xs uppercase tracking-wider opacity-80">BRIX</span>
        </div>
        <div className="rounded-xl border border-hairline bg-card px-3.5 pt-3.5 pb-3">
          <Spectrum legend={false} />
          <div className="mt-3 pt-2.5 border-t border-hairline flex items-center gap-1.5 text-xs text-text-muted">
            <Leaf className="w-3.5 h-3.5" />
            <b className="font-semibold text-text-mid">{cropName}</b>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6 rounded-2xl p-5" style={{ background: zoneBg, border: `1px solid ${zoneBorder}` }}>
      <div className="shrink-0 min-w-[172px]" style={{ color: meta.text }}>
        <div className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-wider font-medium">
          <FlaskConical className="w-3.5 h-3.5" />
          Refractometer reading
        </div>
        <div className="flex items-baseline gap-1.5 mt-2 mb-1.5">
          <span className="font-display font-semibold text-5xl leading-none tabular-nums">{fmt(value)}</span>
          <span className="font-semibold text-xs uppercase tracking-wider opacity-80">BRIX</span>
        </div>
        <div className="font-display text-2xl leading-tight">{quality} Quality</div>
        <div className="flex items-center gap-1.5 mt-1 text-xs text-text-muted">
          <Leaf className="w-3.5 h-3.5" />
          <b className="font-semibold text-text-mid">{cropName}</b>
        </div>
      </div>
      <div className="flex-1 min-w-0 rounded-xl border border-hairline bg-card px-4 pt-4 pb-3.5">
        <Spectrum legend />
      </div>
    </div>
  );
}
