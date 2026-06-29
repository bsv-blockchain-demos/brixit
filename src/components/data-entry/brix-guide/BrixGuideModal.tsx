import { useMemo, useState } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { X, Droplet, Sprout, BookOpen, ExternalLink, Eye } from 'lucide-react';
import { useBrixGuide } from './useBrixGuide';
import { useCropThresholds } from '@/contexts/CropThresholdContext';
import type { BrixThresholds } from '@/lib/getBrixQuality';

/** Full Brix chart PDF (Bionutrient Food Association), served from /public. */
const BRIX_CHART_PDF = '/brix-chart.pdf';
/** Source attribution link. */
const BIONUTRIENT_URL = 'https://www.bionutrient.org/brix';

/** Steps 1 to 4 (step 5 is rendered separately so it can emphasise the payoff). */
const STEPS = [
  'Squeeze a few drops of fresh juice onto the prism.',
  'Close the cover plate. It spreads the juice into a thin film.',
  'Point it at a light source.',
  'Focus the eyepiece.',
];

/** Score legend: dedicated score-ramp tokens (not brand/action colours). */
const TIERS = [
  { label: 'Poor', dot: 'bg-score-poor' },
  { label: 'Average', dot: 'bg-score-average' },
  { label: 'Good', dot: 'bg-score-good' },
  { label: 'Excellent', dot: 'bg-score-excellent' },
] as const;

/** Preferred sample rows; falls back to whatever the dataset has. */
const SAMPLE_CROPS = ['tomato', 'carrot', 'grape'];

type Tier = 'poor' | 'average' | 'good' | 'excellent';

const TIER_META: Record<Tier, { label: string; badge: string }> = {
  poor: { label: 'Poor', badge: 'bg-score-poor' },
  average: { label: 'Average', badge: 'bg-score-average' },
  good: { label: 'Good', badge: 'bg-score-good' },
  excellent: { label: 'Excellent', badge: 'bg-score-excellent' },
};

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

function tierFor(brix: number, t: BrixThresholds): Tier {
  if (brix >= t.excellent) return 'excellent';
  if (brix >= t.good) return 'good';
  if (brix >= t.average) return 'average';
  return 'poor';
}

/** Simplified refractometer eyepiece: blue field over a bright field, orange reading line. */
function RefractometerDiagram() {
  return (
    <svg
      viewBox="0 0 80 80"
      className="w-[72px] h-[72px] shrink-0"
      role="img"
      aria-label="Refractometer eyepiece view"
    >
      <defs>
        <clipPath id="brix-refr-clip">
          <circle cx="40" cy="40" r="38" />
        </clipPath>
      </defs>
      <g clipPath="url(#brix-refr-clip)">
        <rect x="0" y="0" width="80" height="80" fill="hsl(var(--card))" />
        <rect x="0" y="0" width="80" height="33" fill="var(--blue-mid)" />
        <g stroke="var(--select-strong-fg)" strokeWidth="1.5" opacity="0.85">
          <line x1="11" y1="13" x2="24" y2="13" />
          <line x1="11" y1="21" x2="19" y2="21" />
          <line x1="11" y1="29" x2="24" y2="29" />
        </g>
        {/* orange line = the reading (illustrative; not a UI control) */}
        <line x1="0" y1="33" x2="80" y2="33" stroke="var(--action-primary)" strokeWidth="2.5" />
      </g>
      <circle cx="40" cy="40" r="38" fill="none" stroke="var(--field-border)" strokeWidth="2" />
    </svg>
  );
}

export function BrixGuideModal() {
  const { isOpen, close, bannerHidden, hideBanner, showBanner } = useBrixGuide();
  const { cache, getThresholds } = useCropThresholds();

  const crops = useMemo(() => Object.keys(cache).sort(), [cache]);
  const [selectedCrop, setSelectedCrop] = useState('');
  const [brix, setBrix] = useState(9);
  const [pdfOpen, setPdfOpen] = useState(false);

  const activeCrop = selectedCrop || crops[0] || '';
  const activeThresholds = activeCrop ? getThresholds(activeCrop) : null;
  const verdict = activeThresholds ? tierFor(brix, activeThresholds) : null;

  const sampleRows = useMemo(() => {
    const preferred = SAMPLE_CROPS.filter((n) => cache[n]).map((n) => ({ name: n, t: cache[n] }));
    if (preferred.length >= 3) return preferred;
    return Object.entries(cache)
      .slice(0, 3)
      .map(([name, t]) => ({ name, t }));
  }, [cache]);

  return (
    <>
    <Drawer
      open={isOpen}
      onOpenChange={(o) => {
        if (!o) close();
      }}
      shouldScaleBackground={false}
    >
      <DrawerContent
        aria-label="30-second Brix guide"
        className="max-h-[92vh] sm:max-w-lg sm:mx-auto bg-card"
      >
        {/* Header (sticky) */}
        <div className="shrink-0 flex items-start justify-between gap-3 px-5 pt-3 pb-3 border-b border-hairline">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-fresh">30-second guide</p>
            <h2 className="font-display font-bold text-xl text-text-dark mt-0.5">How to measure Brix</h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close guide"
            className="shrink-0 -mr-1 w-8 h-8 inline-flex items-center justify-center rounded-full text-text-mid hover:bg-surface-canvas"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-6 text-sm">
          {/* Intro */}
          <p className="text-text-mid leading-relaxed">
            Brix is the sugars and minerals dissolved in a plant&apos;s juice. Higher Brix generally means
            more nutritious produce. You read it with a small tool called a refractometer.
          </p>

          {/* Take a reading */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-dark">
              <Droplet className="w-4 h-4 text-green-mid" /> Take a reading
            </h3>
            <ol className="space-y-2">
              {STEPS.map((step, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-hairline bg-card px-3 py-2"
                >
                  <span className="shrink-0 mt-0.5 w-6 h-6 inline-flex items-center justify-center rounded-full text-xs font-bold bg-select-bg text-select-fg">
                    {i + 1}
                  </span>
                  <span className="text-text-mid leading-snug">{step}</span>
                </li>
              ))}
              <li className="flex items-start gap-3 rounded-lg border border-hairline bg-card px-3 py-2">
                <span className="shrink-0 mt-0.5 w-6 h-6 inline-flex items-center justify-center rounded-full text-xs font-bold bg-select-bg text-select-fg">
                  5
                </span>
                <span className="text-text-mid leading-snug">
                  Read where light and dark meet. <span className="font-semibold text-green-mid">That&apos;s your Brix.</span>
                </span>
              </li>
            </ol>

            {/* Refractometer diagram + caption */}
            <div className="flex items-start gap-3 rounded-xl border border-hairline bg-card p-3">
              <RefractometerDiagram />
              <p className="text-text-mid leading-snug text-[13px]">
                <span className="font-semibold text-text-dark">What you&apos;ll see.</span> The eyepiece splits into a{' '}
                <span className="text-blue-mid font-medium">blue field</span> and a bright field. Read the number on
                the scale at the line where they meet.
              </p>
            </div>
          </section>

          {/* Which part callout */}
          <div
            className="flex items-start gap-2.5 rounded-xl border p-3"
            style={{
              background: 'var(--green-pale)',
              borderColor: 'color-mix(in srgb, var(--green-fresh) 35%, transparent)',
            }}
          >
            <Sprout className="w-4 h-4 shrink-0 mt-0.5 text-green-mid" />
            <div className="leading-snug">
              <p className="font-semibold text-green-mid">Which part?</p>
              <p className="text-text-mid mt-0.5">
                Whatever you eat, if it&apos;s ripe. If not, use a mature leaf with 2+ hours of sun. (For a leaf, squeeze sap
                instead of juice.)
              </p>
            </div>
          </div>

          {/* Read the chart */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text-dark">
              <BookOpen className="w-4 h-4 text-blue-mid" /> Read the chart
            </h3>
            <p className="text-text-mid leading-snug">
              Find your crop, match your number to the tier.{' '}
              <span className="font-semibold text-text-dark">Always compare within the same crop.</span>
            </p>

            {/* 4-tier legend (single row) */}
            <div className="grid grid-cols-4 gap-1.5">
              {TIERS.map((t) => (
                <div
                  key={t.label}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-hairline bg-card px-2 py-1.5"
                >
                  <span className={`w-2 h-2 shrink-0 rounded-full ${t.dot}`} />
                  <span className="text-xs text-text-dark">{t.label}</span>
                </div>
              ))}
            </div>

            {/* Interactive checker */}
            <div className="rounded-xl border border-hairline bg-surface-canvas p-3 space-y-3">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-blue-mid">
                  <Droplet className="w-3.5 h-3.5" /> Try it
                </p>
                <p className="text-text-mid leading-snug mt-1.5">
                  Plug in any crop and Brix value to see how it scores. Nothing&apos;s saved, experiment freely.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted-brown mb-1">
                    Your crop
                  </label>
                  <select
                    value={activeCrop}
                    onChange={(e) => setSelectedCrop(e.target.value)}
                    className="w-full h-10 rounded-lg border border-field-border bg-card text-text-dark text-sm px-2"
                    aria-label="Your crop"
                  >
                    {crops.length === 0 && <option value="">Loading crops…</option>}
                    {crops.map((c) => (
                      <option key={c} value={c}>
                        {titleCase(c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted-brown mb-1">
                    Your brix
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    inputMode="decimal"
                    value={Number.isNaN(brix) ? '' : brix}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setBrix(Number.isNaN(v) ? 0 : Math.min(Math.max(v, 0), 100));
                    }}
                    className="h-10 text-center font-display font-bold text-text-dark"
                    aria-label="Your brix reading"
                  />
                </div>
              </div>
              {verdict && activeThresholds ? (
                <div className="flex items-center gap-3">
                  <span
                    className={`shrink-0 px-3 py-1 rounded-full text-sm font-bold text-white ${TIER_META[verdict].badge}`}
                  >
                    {TIER_META[verdict].label}
                  </span>
                  <p className="text-text-mid text-[13px] leading-snug">
                    <span className="font-semibold text-text-dark">{brix} Brix</span> on {activeCrop} reads as{' '}
                    {TIER_META[verdict].label.toLowerCase()}. Good starts at {activeThresholds.good}, excellent at{' '}
                    {activeThresholds.excellent}.
                  </p>
                </div>
              ) : (
                <p className="text-text-muted-brown text-[13px]">Pick a crop to see how your reading scores.</p>
              )}
            </div>

            {/* Sample threshold table */}
            {sampleRows.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-hairline">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-table-header text-left text-[11px] uppercase tracking-wider">
                      <th className="px-3 py-2 font-semibold text-text-muted-brown">Crop</th>
                      <th className="px-2 py-2 font-semibold text-score-poor text-center">Poor</th>
                      <th className="px-2 py-2 font-semibold text-score-average text-center">Avg</th>
                      <th className="px-2 py-2 font-semibold text-score-good text-center">Good</th>
                      <th className="px-3 py-2 font-semibold text-score-excellent text-center">Exc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sampleRows.map(({ name, t }) => (
                      <tr key={name} className="border-t border-hairline">
                        <td className="px-3 py-2 font-medium text-text-dark">{titleCase(name)}</td>
                        <td className="px-2 py-2 text-center tabular-nums text-text-mid">{t.poor}</td>
                        <td className="px-2 py-2 text-center tabular-nums text-text-mid">{t.average}</td>
                        <td className="px-2 py-2 text-center tabular-nums text-text-mid">{t.good}</td>
                        <td className="px-3 py-2 text-center tabular-nums text-text-mid">{t.excellent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Full chart link */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-field-border px-3 py-3">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-text-dark">Full chart of 60+ crops</span>
                <span className="block text-xs text-text-muted-brown">
                  Source:{' '}
                  <a
                    href={BIONUTRIENT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-blue-mid hover:text-blue-deep underline underline-offset-2"
                  >
                    Bionutrient Food Association
                  </a>
                </span>
              </span>
              <button
                type="button"
                onClick={() => setPdfOpen(true)}
                className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-blue-mid hover:text-blue-deep"
              >
                <Eye className="w-3.5 h-3.5" /> View BRIX Chart
              </button>
            </div>
          </section>
        </div>

        {/* Footer (sticky) */}
        <div className="shrink-0 border-t border-hairline px-5 py-3 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={bannerHidden}
              onCheckedChange={(c) => (c === true ? hideBanner() : showBanner())}
              className="border-select-strong data-[state=checked]:bg-select-strong data-[state=checked]:border-select-strong data-[state=checked]:text-select-strong-fg"
            />
            <span className="text-sm text-text-mid">Don&apos;t show this again</span>
          </label>
          <button
            type="button"
            onClick={close}
            className="w-full h-11 rounded-xl font-semibold bg-select-strong text-select-strong-fg hover:opacity-90 transition-opacity"
          >
            Got it
          </button>
        </div>
      </DrawerContent>
    </Drawer>

    {/* Full chart popout: PDF viewer stacked above the guide sheet */}
    <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
      <DialogContent className="max-w-3xl w-[95vw] h-[88vh] p-0 gap-0 flex flex-col z-[60] motion-reduce:animate-none">
        <DialogHeader className="px-4 py-3 pr-12 border-b border-hairline space-y-0 text-left">
          <DialogTitle className="text-base font-display">Brix chart</DialogTitle>
          <DialogDescription className="sr-only">Full Brix reference chart for 60+ crops.</DialogDescription>
        </DialogHeader>
        <iframe src={BRIX_CHART_PDF} title="Brix chart" className="flex-1 w-full border-0 bg-card" />
        <a
          href={BRIX_CHART_PDF}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 px-4 py-2 border-t border-hairline text-sm text-blue-mid hover:text-blue-deep"
        >
          Open in new tab <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </DialogContent>
    </Dialog>
    </>
  );
}
