import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, Calendar, MapPin, CheckCircle, Clock, Trash2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  fetchUserDetail,
  verifySubmission,
  deleteSubmission,
  type AppRole,
  type AdminUserDetailSubmission,
} from '@/lib/adminApi';
import { scoreBrix, computeNormalizedScore } from '@/lib/getBrixColor';
import { formatVenueLocation } from '@/lib/formatAddress';
import { titleCase } from '@/lib/titleCase';
import { RoleChip } from '@/components/common/RoleChip';
import { ScoreBadge } from '@/components/common/ScoreBadge';
import { VerifiedBadge, BlockchainBadge } from '@/components/common/StatusBadges';

interface Props {
  userId: string;
  onBack: () => void;
}

function getTopRole(roles: AppRole[] | null | undefined): string {
  if (!roles?.length) return 'user';
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('contributor')) return 'contributor';
  return 'user';
}

// Verification + blockchain status chips (shared badges so they match everywhere).
function StatusChip({ verified, timestamped }: { verified: boolean; timestamped: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <VerifiedBadge verified={verified} />
      <BlockchainBadge secured={timestamped} />
    </span>
  );
}

// Thresholds for crop-relative scoring (poor/excellent are all computeNormalizedScore needs).
const thresholdsOf = (s: AdminUserDetailSubmission) =>
  s.poor_brix != null && s.excellent_brix != null
    ? { poor: s.poor_brix, average: 0, good: 0, excellent: s.excellent_brix }
    : undefined;

function SubmissionModal({
  submission,
  onClose,
  onVerified,
  onDeleted,
}: {
  submission: AdminUserDetailSubmission;
  onClose: () => void;
  onVerified: (id: string, verified: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const [verified, setVerified] = useState(submission.verified);
  const [loading, setLoading] = useState(false);

  const thresholds = thresholdsOf(submission);
  const { normalized, quality } = scoreBrix(submission.brix_value, thresholds);
  const locationStr = formatVenueLocation(submission.place_street_address, submission.place_city, submission.place_state);
  const brand = submission.brand_label ?? submission.brand_name;

  const handleVerify = async (verify: boolean) => {
    setLoading(true);
    try {
      const res = await verifySubmission(submission.id, verify);
      if (res.success) {
        setVerified(verify);
        onVerified(submission.id, verify);
        toast({ title: verify ? 'Submission verified' : 'Submission unverified' });
      } else {
        toast({ title: 'Action failed', description: res.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteSubmission(submission.id);
      toast({ title: 'Submission deleted' });
      onDeleted(submission.id);
      onClose();
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message ?? 'Please try again.', variant: 'destructive' });
      setLoading(false);
    }
  };

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex gap-3">
      <span className="text-text-muted-brown w-16 shrink-0">{label}</span>
      <span className="text-text-dark min-w-0">{children}</span>
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-text-dark">
            {titleCase(submission.crop_label ?? submission.crop_name) || 'Unknown crop'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Score */}
          <div className="flex items-center gap-4">
            <ScoreBadge normalizedScore={normalized} size="lg" />
            <div>
              <div className="font-semibold text-base text-text-dark">{quality}</div>
              <div className="text-sm text-text-mid">{submission.brix_value} BRIX</div>
              {thresholds && (
                <div className="text-xs text-text-muted-brown mt-0.5">
                  Range: {submission.poor_brix}–{submission.excellent_brix}
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm border-t border-hairline pt-3">
            {brand && <Row label="Brand">{brand}</Row>}
            {(submission.place_label || locationStr) && (
              <Row label="Place">
                {submission.place_label
                  ? <>{submission.place_label}{locationStr && <span className="text-text-muted-brown ml-1">({locationStr})</span>}</>
                  : locationStr}
              </Row>
            )}
            <Row label="Date">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-text-muted-brown" />
                {new Date(submission.assessment_date).toLocaleDateString()}
              </span>
            </Row>
            <Row label="Status"><StatusChip verified={verified} timestamped={!!submission.timestamped} /></Row>
            <Row label="ID"><span className="font-mono text-xs text-text-muted-brown break-all">{submission.id}</span></Row>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {!verified ? (
              <Button
                size="sm"
                disabled={loading}
                onClick={() => handleVerify(true)}
                className="flex-1 bg-green-fresh hover:bg-green-mid text-white"
              >
                <Check className="w-4 h-4 mr-1" /> Verify
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled={loading} onClick={() => handleVerify(false)} className="flex-1">
                Unverify
              </Button>
            )}
            <Button size="sm" variant="destructive" disabled={loading} onClick={handleDelete}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminUserDetail({ userId, onBack }: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<AdminUserDetailSubmission | null>(null);

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin-user-detail', userId],
    queryFn: () => fetchUserDetail(userId),
    staleTime: Infinity,
  });

  const handleVerified = (id: string, verified: boolean) => {
    queryClient.setQueryData(['admin-user-detail', userId], (old: typeof user) => {
      if (!old) return old;
      return {
        ...old,
        submissions: old.submissions.map((s) => s.id === id ? { ...s, verified } : s),
      };
    });
  };

  const handleDeleted = (id: string) => {
    queryClient.setQueryData(['admin-user-detail', userId], (old: typeof user) => {
      if (!old) return old;
      return { ...old, submissions: old.submissions.filter((s) => s.id !== id) };
    });
  };

  const backButton = (
    <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 text-text-mid hover:text-text-dark hover:bg-surface-canvas">
      <ChevronLeft className="w-4 h-4 mr-1" /> All Users
    </Button>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {backButton}
        <p className="text-sm text-text-mid">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        {backButton}
        <p className="text-sm text-text-mid">User not found.</p>
      </div>
    );
  }

  const topRole = getTopRole(user.roles);
  const locationParts = [formatVenueLocation(undefined, user.city, user.state), user.country].filter(Boolean);

  return (
    <div className="space-y-6">
      {backButton}

      {selected && (
        <SubmissionModal
          submission={selected}
          onClose={() => setSelected(null)}
          onVerified={handleVerified}
          onDeleted={handleDeleted}
        />
      )}

      {/* Identity card */}
      <div className="bg-card border border-hairline rounded-2xl shadow-sm p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-xl text-text-dark">{user.display_name ?? user.id}</h2>
            <p className="text-xs font-mono text-text-muted-brown mt-1 break-all">
              Wallet identity: {user.identity_key ?? <span className="italic">no wallet identity</span>}
            </p>
            <p className="text-xs font-mono text-text-muted-brown mt-0.5 break-all">UUID: {user.id}</p>
          </div>
          <RoleChip role={topRole} />
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-text-mid border-t border-hairline pt-3">
          <span><strong className="font-semibold text-text-dark">{user.points ?? 0}</strong> points</span>
          <span><strong className="font-semibold text-text-dark">{user.submission_count ?? 0}</strong> submissions</span>
          {user.created_at && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-text-muted-brown" />
              Joined {new Date(user.created_at).toLocaleDateString()}
            </span>
          )}
          {locationParts.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-text-muted-brown" />
              {locationParts.join(', ')}
            </span>
          )}
        </div>
      </div>

      {/* Recent submissions */}
      <div>
        <h3 className="font-display font-bold text-base text-text-dark mb-3">
          Recent Submissions ({user.submissions.length}{user.submissions.length === 50 ? '+' : ''})
        </h3>
        {user.submissions.length === 0 ? (
          <p className="text-sm text-text-mid">No submissions yet.</p>
        ) : (
          <div className="space-y-3">
            {user.submissions.map((s) => {
              const normalized = computeNormalizedScore(s.brix_value, thresholdsOf(s));
              const loc = formatVenueLocation(s.place_street_address, s.place_city, s.place_state);
              const locationText = [s.place_label, loc].filter(Boolean).join(' · ') || '-';
              const brand = s.brand_label ?? s.brand_name;
              return (
                <div
                  key={s.id}
                  className="bg-card border border-hairline rounded-2xl shadow-sm p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-surface-canvas transition-colors"
                  onClick={() => setSelected(s)}
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-text-dark">{titleCase(s.crop_label ?? s.crop_name) || 'Unknown crop'}</span>
                      {brand && <span className="text-text-mid text-sm">· {brand}</span>}
                      <StatusChip verified={s.verified} timestamped={!!s.timestamped} />
                    </div>
                    <div className="flex items-start gap-1.5 text-sm text-text-mid">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-text-muted-brown" />
                      <span className="min-w-0">{locationText}</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 text-sm text-text-muted-brown">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(s.assessment_date).toLocaleDateString()}
                    </div>
                  </div>
                  <ScoreBadge normalizedScore={normalized} size="sm" className="shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
