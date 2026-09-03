/**
 * Flagged-measurements section for My Data: readings an admin rejected, each
 * with the reason and a shortcut into the edit-and-resubmit flow.
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Edit } from 'lucide-react';
import { BrixDataPoint } from '../../types';
import { fetchMySubmissionsPage } from '../../lib/fetchSubmissions';
import { gradeBrix } from '../../lib/getBrixColor';
import { titleCase } from '../../lib/titleCase';
import { formatHumanDate } from '../../lib/formatDate';
import { ScoreGauge } from '../common/ScoreGauge';
import { Button } from '../ui/button';
import ResubmitSubmission from '../common/ResubmitSubmission';

const RejectedSubmissions: React.FC<{ userId: string }> = ({ userId }) => {
  const queryClient = useQueryClient();
  const [resubmitTarget, setResubmitTarget] = useState<BrixDataPoint | null>(null);

  const queryKey = ['submissions', 'mine', 'rejected', userId];
  const rejectedQuery = useQuery<BrixDataPoint[]>({
    queryKey,
    queryFn: () => fetchMySubmissionsPage({ userId, limit: 50, offset: 0, rejected: true }),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const rejectedItems = rejectedQuery.data || [];

  // Invisible to users with nothing flagged — no empty-state clutter on My Data.
  if (rejectedItems.length === 0) return null;

  const handleResubmitSuccess = (updated: BrixDataPoint) => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ['submissions', 'mine'] });
    setResubmitTarget(null);
  };

  return (
    <section className="mb-6 space-y-4">
      <div>
        <h2 className="text-xl font-display font-bold text-on-bg-text">Your flagged measurements</h2>
        <p className="mt-1 text-sm text-text-mid">Adjust them and send them back for review.</p>
      </div>

      <div className="space-y-3">
        {rejectedItems.map((item) => {
          const cropThresholds = (item.poorBrix != null && item.excellentBrix != null)
            ? { poor: item.poorBrix, average: item.averageBrix ?? 0, good: item.goodBrix ?? 0, excellent: item.excellentBrix }
            : undefined;
          const { quality } = gradeBrix(item.brixLevel, cropThresholds);

          return (
            <div
              key={item.id}
              className="bg-card text-card-foreground border border-hairline rounded-2xl shadow-sm p-4"
            >
              <div className="flex flex-col desktop:flex-row desktop:items-start desktop:justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-text-dark truncate">{titleCase(item.cropLabel ?? item.cropType)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-text-mid">
                    <span className="font-mono font-bold text-text-dark tabular-nums">{item.brixLevel} BRIX</span>
                    <span>{formatHumanDate(item.submittedAt)}</span>
                    {item.locationName && <span>{item.locationName}</span>}
                  </div>
                </div>
                <ScoreGauge thresholds={cropThresholds} value={item.brixLevel} quality={quality} className="shrink-0" />
              </div>

              <div className="mt-3 rounded-xl border border-score-average bg-score-average-bg p-3 flex gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-score-average" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-score-average">Why this was flagged</p>
                  <p className="mt-1 text-sm text-text-dark">{item.rejectionMessage}</p>
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => { if (item.rejected) setResubmitTarget(item); }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit & resubmit
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Gated on `rejected` too, so a stale cache entry can never reopen this for
          a reading that has since left the rejected state. */}
      <ResubmitSubmission
        dataPoint={resubmitTarget}
        isOpen={!!resubmitTarget && resubmitTarget.rejected}
        onClose={() => setResubmitTarget(null)}
        onResubmitSuccess={handleResubmitSuccess}
      />
    </section>
  );
};

export default RejectedSubmissions;
