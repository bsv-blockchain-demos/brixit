import React from 'react';
import { TableCell, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { BrixDataPoint } from '../../types';
import { MapPin, Calendar, CheckCircle, Edit, Trash2, Eye, MessageSquare, Stamp, Lock, User, XCircle, Anchor } from 'lucide-react';
import { gradeBrix } from '../../lib/getBrixColor';
import { formatCityState } from '../../lib/formatAddress';
import { titleCase } from '../../lib/titleCase';
import { VerifiedBadge, BlockchainBadge, HintPopover } from './StatusBadges';
import { ScoreGauge } from './ScoreGauge';
import { formatHumanDate, formatRelativeTime } from '../../lib/formatDate';

interface SubmissionTableRowProps {
  submission: BrixDataPoint;
  onDelete: (id: string) => void;
  isOwner: boolean; // Indicates if the current user is the owner (passed from parent)
  canDeleteByOwner: boolean; // Indicates if owner can delete (based on RLS and verified status, passed from parent)
  onOpenModal: (submission: BrixDataPoint) => void;
  onEdit?: () => void;
  showOwnerBadge?: boolean;
  onRetry?: () => void;
  isRetrying?: boolean;
}

const SubmissionTableRow: React.FC<SubmissionTableRowProps> = ({ submission, onDelete, isOwner, canDeleteByOwner, onOpenModal, onEdit, showOwnerBadge = true, onRetry, isRetrying }) => {
  const cropThresholds = (submission.poorBrix != null && submission.excellentBrix != null)
    ? { poor: submission.poorBrix, average: submission.averageBrix ?? 0, good: submission.goodBrix ?? 0, excellent: submission.excellentBrix }
    : undefined;
  const { quality } = gradeBrix(submission.brixLevel, cropThresholds);

  // Determine if the edit button should be visible (only owner can edit)
  const canEdit = isOwner;

  return (
    <TableRow
      key={submission.id}
      className="border-hairline hover:bg-surface-canvas transition-colors cursor-pointer"
      onClick={() => onOpenModal(submission)} // Make the whole row clickable
    >
      {/* Date */}
      <TableCell className="py-3 px-4 whitespace-nowrap">
        <div className="flex items-center space-x-1 text-sm text-text-mid">
          <Calendar className="w-3.5 h-3.5 text-text-muted-brown" />
          {/* Relative for scanning; exact date on hover for precision. */}
          <span title={formatHumanDate(submission.submittedAt)}>
            {formatRelativeTime(submission.submittedAt)}
          </span>
        </div>
      </TableCell>

      {/* Crop */}
      <TableCell className="py-3 px-4">
        <div>
          <span className="text-sm text-text-mid">{titleCase(submission.cropLabel ?? submission.cropType)}</span>
          {showOwnerBadge && isOwner && (
            <Badge className="flex items-center space-x-1 px-2 py-0.5 rounded-md border border-hairline bg-transparent text-text-mid font-medium text-xs mt-1 w-fit">
              <User className="w-3 h-3" />
              <span>Your Reading</span>
            </Badge>
          )}
        </div>
      </TableCell>

      {/* Cell 2 — Variety (hidden until cropVariety is actually populated server-side)
      <TableCell className="py-3 px-4 max-w-[120px] truncate text-sm text-text-mid">
        {submission.variety || <span className="text-text-muted-brown">--</span>}
      </TableCell>
      */}

      {/* Cell 3 — Brand */}
      <TableCell className="py-3 px-4 max-w-[120px] truncate text-sm text-text-mid">
        {submission.brandName || <span className="text-text-muted-brown">--</span>}
      </TableCell>

      {/* Cell 4 — Location */}
      <TableCell className="py-3 px-4 max-w-[180px]">
        {submission.locationName ? (
          <div>
            <div className="flex items-center space-x-1 text-sm text-text-mid">
              <MapPin className="w-3.5 h-3.5 text-text-muted-brown flex-shrink-0" />
              <span className="font-medium truncate">{submission.locationName}</span>
            </div>
            {/* Smart address sub-line */}
            {(() => {
              const { streetAddress, city, state, country } = submission;
              if (streetAddress && (
                (city && streetAddress.toLowerCase().includes(city.toLowerCase())) ||
                (state && streetAddress.toLowerCase().includes(state.toLowerCase()))
              )) {
                return (
                  <div className="text-xs text-text-muted-brown ml-5 truncate" title={streetAddress}>
                    {streetAddress}
                  </div>
                );
              }
              const addressParts = [streetAddress, formatCityState(city, state), country].filter(Boolean);
              if (addressParts.length > 0) {
                const fullAddress = addressParts.join(', ');
                return (
                  <div className="text-xs text-text-muted-brown ml-5 truncate" title={fullAddress}>
                    {fullAddress}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        ) : (
          <span className="text-text-muted-brown">--</span>
        )}
      </TableCell>

      {/* BRIX — raw reading (its own numeric column) */}
      <TableCell className="text-center py-3 px-4 whitespace-nowrap">
        {typeof submission.brixLevel === 'number'
          ? <span className="font-mono font-bold text-sm text-text-dark tabular-nums">{submission.brixLevel}</span>
          : <span className="text-text-muted-brown text-sm">--</span>}
      </TableCell>

      {/* Score — tier pill + fill gauge on the crop's own scale */}
      <TableCell className="text-center py-3 px-4">
        <ScoreGauge thresholds={cropThresholds} value={submission.brixLevel} quality={quality} className="mx-auto" />
      </TableCell>

      {/* Cell 6 — Notes */}
      <TableCell className="py-3 px-4">
        {submission.outlier_notes ? (
          // Icon only; the note reads in a popover on hover (tap on touch)
          // rather than as two clamped lines that stretch the row.
          <HintPopover help={submission.outlier_notes}>
            <span
              tabIndex={0}
              role="button"
              aria-label="Show note"
              className="inline-flex items-center justify-center w-6 h-6 rounded-full cursor-help text-text-muted-brown hover:bg-surface-canvas"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </span>
          </HintPopover>
        ) : (
          <span className="text-text-muted-brown text-sm">--</span>
        )}
      </TableCell>

      {/* Verified? */}
      <TableCell className="py-3 px-2">
        <VerifiedBadge verified={!!submission.verified} />
      </TableCell>

      {/* Cell 9 — Blockchain */}
      <TableCell className="py-3 px-2">
        <BlockchainBadge secured={!!submission.outpoint} />
      </TableCell>

      {/* Cell 9 — Actions */}
      <TableCell className="text-right py-3 px-4">
        <div className="flex justify-end items-center space-x-1">
          {onRetry && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Retry timestamp"
                  disabled={isRetrying}
                  onClick={(e) => { e.stopPropagation(); onRetry(); }}
                >
                  <Stamp className={`w-5 h-5 ${isRetrying ? 'animate-pulse' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Retry timestamp</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="View reading details"
                onClick={() => onOpenModal(submission)}
              >
                <Eye className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View</TooltipContent>
          </Tooltip>

          {canEdit && onEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Edit reading"
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                >
                  <Edit className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
          )}

          {canDeleteByOwner ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(submission.id)}
                  className="text-destructive hover:text-destructive/80"
                  aria-label="Delete reading"
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          ) : (
            isOwner && submission.verified && (
              <span title="Verified readings cannot be deleted by non-admins." className="cursor-not-allowed">
                <Button variant="ghost" size="sm" className="text-text-muted-brown opacity-70 cursor-not-allowed" disabled>
                  <Lock className="w-5 h-5" />
                </Button>
              </span>
            )
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

export default SubmissionTableRow;