import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CheckCircle, Clock, Stamp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Canonical status badges for the two submission states, used everywhere so the
 * header, colour, pill, icon and wording stay identical platform-wide.
 *
 *  - Verified   → admin data-quality approval (independent of the blockchain).
 *  - Blockchain → on-chain record state ("Secured" once anchored, else "Pending").
 *
 * Both wrap an info popover that explains the field to the user. See [[blockchain-secured-terminology]].
 */

const PILL = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap';

/**
 * Info bubble that is usable on every device. Radix Popover toggles on tap/click
 * (so it works on touch out of the box), and we layer hover open/close on
 * hover-capable (desktop mouse) devices only. On those devices we also suppress
 * the click toggle, so a desktop click never fights the hover state; on touch the
 * click toggle is what opens it. Tapping outside or pressing Escape dismisses it.
 */
function HintPopover({
  children,
  help,
  contentClassName,
}: {
  children: React.ReactElement;
  help: React.ReactNode;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const hoverCapable =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover)').matches;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        asChild
        onMouseEnter={hoverCapable ? () => setOpen(true) : undefined}
        onMouseLeave={hoverCapable ? () => setOpen(false) : undefined}
        onClick={(e) => {
          // Never let the hint click bubble to a clickable row/header (sort, navigate).
          e.stopPropagation();
          // Desktop is driven by hover; stop the click from toggling (and closing) it.
          // On touch (no hover) the click toggle is what opens the bubble.
          if (hoverCapable) e.preventDefault();
        }}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          'w-auto max-w-[16rem] p-3 text-sm font-normal normal-case tracking-normal leading-snug',
          contentClassName,
        )}
      >
        {help}
      </PopoverContent>
    </Popover>
  );
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <HintPopover
      help={
        verified
          ? 'Approved and shown publicly. Readings are approved automatically, with outliers checked by an admin.'
          : 'Flagged as an outlier and waiting on an admin review before it is published.'
      }
    >
      <span
        tabIndex={0}
        role="button"
        className={`${PILL} cursor-help ${verified ? 'bg-score-excellent-bg text-score-excellent' : 'bg-score-average-bg text-score-average'}`}
      >
        {verified ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
        {verified ? 'Verified' : 'Pending'}
      </span>
    </HintPopover>
  );
}

export function BlockchainBadge({ secured }: { secured: boolean }) {
  return (
    <HintPopover
      help={
        secured
          ? 'Timestamped by anchoring this reading to the BSV blockchain, giving it a permanent, tamper-evident record.'
          : 'Not yet anchored to the BSV blockchain. Anchoring is still pending, so the on-chain timestamp is not final.'
      }
    >
      <span
        tabIndex={0}
        role="button"
        className={`${PILL} cursor-help ${secured ? 'bg-select-bg text-select-fg' : 'bg-badge-neutral-bg text-badge-neutral-text'}`}
      >
        <Stamp className="w-3.5 h-3.5" />
        {secured ? 'Timestamped' : 'Pending'}
      </span>
    </HintPopover>
  );
}

/** Column-header label with an info popover explaining the field (hover on desktop, tap on mobile). */
export function ColumnHint({ children, help }: { children: React.ReactNode; help: string }) {
  return (
    <HintPopover help={help}>
      <span
        tabIndex={0}
        role="button"
        className="cursor-help underline decoration-dotted decoration-1 underline-offset-4"
      >
        {children}
      </span>
    </HintPopover>
  );
}

// Aggregate "Score" (leaderboard): the gauge shows the average quality as a tier
// label (Poor to Excellent) plus a slider, not a percentage. See [[score-is-crop-relative]].
export const SCORE_HELP =
  "The average quality of this entry's readings, rated Poor to Excellent. The slider shows where that average sits between poor and excellent. Each reading is scored against its own crop's range, so different produce compares fairly. Higher is better.";

// Individual "Score" (data tables): a quality rating (Poor to Excellent) plus a gauge
// of where the single reading sits on its crop's scale. No percentage.
export const SCORE_RATING_HELP =
  "How this reading rates on its crop's own scale, from Poor to Excellent. The gauge shows where it lands between the crop's poor and excellent thresholds, so different produce can be compared fairly. Higher is better.";

// The raw refractometer reading shown in the BRIX column (its own number).
export const BRIX_HELP =
  "The raw refractometer reading: a measure of the sugars and nutrients dissolved in the sample. It is the unadjusted number, so use the Score to compare crops, since the same BRIX means different things for different crops.";

/** "Score" column-header label with the standard score-explanation popover. */
export function ScoreHint({ children = 'Score', variant = 'aggregate' }: { children?: React.ReactNode; variant?: 'aggregate' | 'rating' }) {
  return <ColumnHint help={variant === 'rating' ? SCORE_RATING_HELP : SCORE_HELP}>{children}</ColumnHint>;
}
