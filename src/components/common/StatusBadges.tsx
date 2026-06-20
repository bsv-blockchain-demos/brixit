import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, Clock, Anchor, Info } from 'lucide-react';

/**
 * Canonical status badges for the two submission states, used everywhere so the
 * header, colour, pill, icon and wording stay identical platform-wide.
 *
 *  - Verified   → admin data-quality approval (independent of the blockchain).
 *  - Blockchain → on-chain record state ("Secured" once anchored, else "Pending").
 *
 * Both wrap a tooltip that explains the field to the user. See [[blockchain-secured-terminology]].
 */

const PILL = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap';

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`${PILL} ${verified ? 'bg-score-excellent-bg text-score-excellent' : 'bg-score-average-bg text-score-average'}`}>
          {verified ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
          {verified ? 'Verified' : 'Pending'}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[16rem]">
        {verified
          ? 'Approved and shown publicly. Readings are approved automatically, with outliers checked by an admin.'
          : 'Flagged as an outlier and waiting on an admin review before it is published.'}
      </TooltipContent>
    </Tooltip>
  );
}

export function BlockchainBadge({ secured }: { secured: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`${PILL} ${secured ? 'bg-score-excellent-bg text-score-excellent' : 'bg-badge-neutral-bg text-badge-neutral-text'}`}>
          <Anchor className="w-3.5 h-3.5" />
          {secured ? 'Timestamped' : 'Pending'}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[16rem]">
        {secured
          ? 'Recorded on the BSV blockchain, giving this reading a permanent, tamper-evident timestamp.'
          : 'Not written to the BSV blockchain yet. The on-chain record is still pending.'}
      </TooltipContent>
    </Tooltip>
  );
}

/** Column-header label with an info tooltip explaining the field. */
export function ColumnHint({ children, help }: { children: React.ReactNode; help: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 cursor-help">
          {children}
          <Info className="w-3 h-3 opacity-60" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[16rem] normal-case font-normal tracking-normal">{help}</TooltipContent>
    </Tooltip>
  );
}
