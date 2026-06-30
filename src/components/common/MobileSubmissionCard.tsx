import React from 'react';
import { BrixDataPoint } from '../../types';
import { gradeBrix } from '../../lib/getBrixColor';
import { titleCase } from '../../lib/titleCase';
import { VerifiedBadge, BlockchainBadge } from './StatusBadges';
import { ScoreGauge } from './ScoreGauge';
import { formatHumanDate } from '../../lib/formatDate';
import { CheckCircle, Stamp, MapPin, User, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';

const MobileSubmissionCard: React.FC<{
  submission: BrixDataPoint;
  isOwner: boolean;
  onOpenModal: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onRetry?: () => void;
  isRetrying?: boolean;
}> = ({ submission, isOwner, onOpenModal, onEdit, onDelete, onRetry, isRetrying }) => {
  const cropThresholds = (submission.poorBrix != null && submission.excellentBrix != null)
    ? { poor: submission.poorBrix, average: submission.averageBrix ?? 0, good: submission.goodBrix ?? 0, excellent: submission.excellentBrix }
    : undefined;
  const { quality } = gradeBrix(submission.brixLevel, cropThresholds);
  const hasActions = !!(onEdit || onDelete || onRetry);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenModal}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenModal(); } }}
      className="w-full text-left rounded-xl border border-hairline bg-card text-card-foreground p-4 shadow-sm active:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-text-dark truncate">{titleCase(submission.cropLabel ?? submission.cropType)}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-1.5 -m-1 rounded-lg hover:bg-surface-canvas transition-colors"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Submission actions"
                >
                  <MoreVertical className="w-4 h-4 text-text-mid" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4}>
                {onRetry && (
                  <DropdownMenuItem
                    disabled={isRetrying}
                    onClick={(e) => { e.stopPropagation(); onRetry(); }}
                  >
                    <Stamp className="w-4 h-4 mr-2" />
                    Retry timestamp
                  </DropdownMenuItem>
                )}
                {onRetry && (onEdit || onDelete) && <DropdownMenuSeparator />}
                {onEdit && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onEdit && onDelete && <DropdownMenuSeparator />}
                {onDelete && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* BRIX + Score: the two desktop columns, brought into the card */}
      <div className="mt-3 flex items-center gap-4">
        <div className="shrink-0">
          {typeof submission.brixLevel === 'number'
            ? <span className="font-mono font-bold text-lg text-text-dark tabular-nums">{submission.brixLevel}</span>
            : <span className="text-text-muted-brown text-sm">--</span>}
          <span className="ml-1 text-2xs uppercase tracking-wide text-text-muted">BRIX</span>
        </div>
        <ScoreGauge thresholds={cropThresholds} value={submission.brixLevel} quality={quality} />
      </div>

      <div className="mt-3 text-sm text-text-mid">
        {formatHumanDate(submission.submittedAt)}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <VerifiedBadge verified={!!submission.verified} />
        <BlockchainBadge secured={!!submission.outpoint} />
      </div>

      {submission.locationName && (
        <div className="mt-2 flex items-center gap-1.5 text-sm text-text-muted-brown">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{submission.locationName}</span>
        </div>
      )}

      {isOwner && (
        <Badge className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-hairline bg-transparent text-text-mid font-medium text-xs">
          <User className="w-3 h-3" />
          Your Submission
        </Badge>
      )}
    </div>
  );
};

export default MobileSubmissionCard;
