import React from 'react';
import { BrixDataPoint } from '../../types';
import { useBrixColorFromContext } from '../../lib/getBrixColor';
import { CheckCircle, Clock, MapPin, User, MoreVertical, Edit, Trash2 } from 'lucide-react';
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
  const brixColorClass = useBrixColorFromContext(
    submission.cropType?.toLowerCase().trim() || '',
    submission.brixLevel
  );
  const hasActions = !!(onEdit || onDelete);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenModal}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenModal(); } }}
      className="w-full text-left rounded-xl border border-green-pale bg-white p-4 shadow-sm active:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text-dark truncate capitalize">{submission.cropType}</p>
          {submission.variety && (
            <p className="text-xs text-text-muted-green">{submission.variety}</p>
          )}
          {submission.brandName && (
            <p className="text-xs text-text-dark mt-0.5">Brand: {submission.brandName}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-1.5 -m-1 rounded-lg hover:bg-green-mist transition-colors"
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
            {submission.brixLevel ?? 'N/A'}
          </Badge>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-mid">
        <span>{new Date(submission.submittedAt).toLocaleDateString()}</span>
        <span>·</span>
        {submission.verified ? (
          <span className="inline-flex items-center gap-1 text-green-700">
            <CheckCircle className="w-3 h-3" /> Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-orange-600">
            <Clock className="w-3 h-3" /> Pending
          </span>
        )}
      </div>

      {submission.locationName && (
        <div className="mt-1.5 flex items-center gap-1 text-xs text-text-muted-green">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{submission.locationName}</span>
        </div>
      )}

      {isOwner && (
        <Badge className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-pale text-green-fresh font-medium text-xs">
          <User className="w-3 h-3" />
          Your Submission
        </Badge>
      )}
    </div>
  );
};

export default MobileSubmissionCard;
