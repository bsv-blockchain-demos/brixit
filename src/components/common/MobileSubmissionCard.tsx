import React from 'react';
import { BrixDataPoint } from '../../types';
import { scoreBrix } from '../../lib/getBrixColor';
import { titleCase } from '../../lib/titleCase';
import { CheckCircle, Clock, MapPin, User, MoreVertical, Edit, Trash2, XCircle, Shield } from 'lucide-react';
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
}> = ({ submission, isOwner, onOpenModal, onEdit, onDelete }) => {
  const cropThresholds = (submission.poorBrix != null && submission.excellentBrix != null)
    ? { poor: submission.poorBrix, average: submission.averageBrix ?? 0, good: submission.goodBrix ?? 0, excellent: submission.excellentBrix }
    : undefined;
  const { bgClass: brixColorClass, display: displayScore } = scoreBrix(submission.brixLevel, cropThresholds);
  const hasActions = !!(onEdit || onDelete);

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
          <Badge
            className={`${brixColorClass} text-white px-3 py-1 rounded-xl font-bold text-base shadow-sm`}
          >
            {displayScore}
          </Badge>
        </div>
      </div>

      <div className="mt-2 text-sm text-text-mid">
        {new Date(submission.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {submission.verified ? (
          <span className="inline-flex items-center gap-1 text-green-mid font-medium">
            <CheckCircle className="w-3.5 h-3.5" /> Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-action-primary font-medium">
            <Clock className="w-3.5 h-3.5" /> Pending
          </span>
        )}
        <span className="text-text-muted-brown">·</span>
        {submission.outpoint ? (
          <span className="inline-flex items-center gap-1 text-blue-mid font-medium">
            <Shield className="w-3.5 h-3.5" /> Anchored
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-text-muted-brown">
            <XCircle className="w-3.5 h-3.5" /> No Anchor
          </span>
        )}
      </div>

      {submission.locationName && (
        <div className="mt-2 flex items-center gap-1.5 text-sm text-text-muted-brown">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{submission.locationName}</span>
        </div>
      )}

      {isOwner && (
        <Badge className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-pale text-green-fresh font-medium text-xs">
          <User className="w-3 h-3" />
          Your Submission
        </Badge>
      )}
    </div>
  );
};

export default MobileSubmissionCard;
