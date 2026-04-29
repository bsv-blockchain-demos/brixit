import React from 'react';
import { TableCell, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { BrixDataPoint } from '../../types';
import { MapPin, Calendar, CheckCircle, Edit, Trash2, Eye, MessageSquare, Clock, Lock, User } from 'lucide-react';
import { scoreBrix } from '../../lib/getBrixColor';
import { formatCityState } from '../../lib/formatAddress';

interface SubmissionTableRowProps {
  submission: BrixDataPoint;
  onDelete: (id: string) => void;
  isOwner: boolean; // Indicates if the current user is the owner (passed from parent)
  canDeleteByOwner: boolean; // Indicates if owner can delete (based on RLS and verified status, passed from parent)
  onOpenModal: (submission: BrixDataPoint) => void;
  onEdit?: () => void;
  showOwnerBadge?: boolean;
}

const SubmissionTableRow: React.FC<SubmissionTableRowProps> = ({ submission, onDelete, isOwner, canDeleteByOwner, onOpenModal, onEdit, showOwnerBadge = true }) => {
  const cropThresholds = (submission.poorBrix != null && submission.excellentBrix != null)
    ? { poor: submission.poorBrix, average: submission.averageBrix ?? 0, good: submission.goodBrix ?? 0, excellent: submission.excellentBrix }
    : undefined;
  const { bgClass: brixColorClass, display: displayScore } = scoreBrix(submission.brixLevel, cropThresholds);

  // Determine if the edit button should be visible (only owner can edit)
  const canEdit = isOwner;

  return (
    <TableRow
      key={submission.id}
      className="border-blue-pale odd:bg-card even:bg-table-stripe hover:bg-table-stripe transition-colors cursor-pointer"
      onClick={() => onOpenModal(submission)} // Make the whole row clickable
    >
      {/* Cell 1 — Crop */}
      <TableCell className="py-3 px-4">
        <div>
          <span className="text-sm text-text-mid">{submission.cropLabel ?? submission.cropType}</span>
          {showOwnerBadge && isOwner && (
            <Badge className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-pale text-green-fresh font-medium text-xs mt-1 w-fit">
              <User className="w-3 h-3" />
              <span>Your Submission</span>
            </Badge>
          )}
        </div>
      </TableCell>

      {/* Cell 2 — Variety */}
      <TableCell className="py-3 px-4 max-w-[120px] truncate text-sm text-text-mid">
        {submission.variety || <span className="text-text-muted-brown">--</span>}
      </TableCell>

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

      {/* Cell 5 — Score */}
      <TableCell className="text-center py-3 px-4">
        <Badge
          className={`${brixColorClass} text-white px-3 py-1 rounded-xl font-bold text-base shadow-sm`}
        >
          {displayScore}
        </Badge>
      </TableCell>

      {/* Cell 6 — Notes */}
      <TableCell className="py-3 px-4 max-w-[150px]">
        {submission.outlier_notes ? (
          <div className="flex items-start space-x-1 text-sm text-text-mid line-clamp-2">
            <MessageSquare className="w-3 h-3 flex-shrink-0 text-text-muted-brown mt-0.5" />
            <span>{submission.outlier_notes}</span>
          </div>
        ) : (
          <span className="text-text-muted-brown text-sm">--</span>
        )}
      </TableCell>

      {/* Cell 7 — Date */}
      <TableCell className="py-3 px-4 whitespace-nowrap">
        <div className="flex items-center space-x-1 text-sm text-text-mid">
          <Calendar className="w-3.5 h-3.5 text-text-muted-brown" />
          <span>{new Date(submission.submittedAt).toLocaleDateString()}</span>
        </div>
      </TableCell>

      {/* Cell 8 — Verified? */}
      <TableCell className="text-center py-3 px-4">
        {submission.verified ? (
          <Badge className="flex items-center space-x-1 px-3 py-1 rounded-full bg-green-pale text-green-mid font-medium text-sm shadow-sm">
            <CheckCircle className="w-4 h-4" />
            <span>Verified</span>
          </Badge>
        ) : (
          <Badge className="flex items-center space-x-1 px-3 py-1 rounded-full bg-[var(--badge-amber-bg)] text-[var(--badge-amber-text)] font-semibold text-sm shadow-sm">
            <Clock className="w-4 h-4" />
            <span>Pending</span>
          </Badge>
        )}
      </TableCell>

      {/* Cell 9 — Actions */}
      <TableCell className="text-center py-3 px-4">
        <div className="flex justify-center items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="View submission details"
            onClick={() => onOpenModal(submission)}
          >
            <Eye className="w-5 h-5" />
          </Button>

          {canEdit && onEdit && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Edit submission"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
            >
              <Edit className="w-5 h-5" />
            </Button>
          )}

          {canDeleteByOwner ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(submission.id)}
              className="text-destructive hover:text-destructive/80"
              aria-label="Delete submission"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          ) : (
            isOwner && submission.verified && (
              <span title="Verified submissions cannot be deleted by non-admins." className="cursor-not-allowed">
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