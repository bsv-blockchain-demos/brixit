import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, Calendar, MapPin, CheckCircle, Clock, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  fetchUserDetail,
  verifySubmission,
  deleteSubmission,
  type AppRole,
  type AdminUserDetailSubmission,
} from '@/lib/adminApi';
import { scoreBrix } from '@/lib/getBrixColor';
import { formatVenueLocation } from '@/lib/formatAddress';

interface Props {
  userId: string;
  onBack: () => void;
}

function getRoleBadgeVariant(role: string) {
  if (role === 'admin') return 'default' as const;
  if (role === 'contributor') return 'secondary' as const;
  return 'outline' as const;
}

function getTopRole(roles: AppRole[] | null | undefined): string {
  if (!roles?.length) return 'user';
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('contributor')) return 'contributor';
  return 'user';
}

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

  const thresholds = (submission.poor_brix != null && submission.excellent_brix != null)
    ? { poor: submission.poor_brix, average: 0, good: 0, excellent: submission.excellent_brix }
    : undefined;
  const { display: displayScore, bgClass, quality } = scoreBrix(submission.brix_value, thresholds);
  const locationStr = formatVenueLocation(submission.place_street_address, submission.place_city, submission.place_state);

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

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{submission.crop_label ?? submission.crop_name ?? 'Unknown crop'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Score */}
          <div className="flex items-center gap-4">
            <div className={`px-4 py-2 rounded-xl text-white text-2xl font-bold ${bgClass}`}>
              {displayScore}
            </div>
            <div>
              <div className="font-semibold text-base">{quality}</div>
              <div className="text-sm text-muted-foreground">{submission.brix_value} Brix</div>
              {thresholds && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  Range: {submission.poor_brix}–{submission.excellent_brix}
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm border-t pt-3">
            {(submission.brand_label ?? submission.brand_name) && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-16 shrink-0">Brand</span>
                <span>{submission.brand_label ?? submission.brand_name}</span>
              </div>
            )}
            {(submission.place_label || locationStr) && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-16 shrink-0">Place</span>
                <span>
                  {submission.place_label
                    ? <>{submission.place_label}{locationStr && <span className="text-muted-foreground ml-1">({locationStr})</span>}</>
                    : locationStr}
                </span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 shrink-0">Date</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(submission.assessment_date).toLocaleDateString()}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 shrink-0">Status</span>
              {verified ? (
                <span className="inline-flex items-center gap-1 text-action-primary">
                  <CheckCircle className="w-3 h-3" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-gold">
                  <Clock className="w-3 h-3" /> Pending
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-16 shrink-0">ID</span>
              <span className="font-mono text-xs text-muted-foreground break-all">{submission.id}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {!verified ? (
              <Button
                size="sm"
                disabled={loading}
                onClick={() => handleVerify(true)}
                className="flex-1 bg-action-primary hover:bg-action-primary-hover text-white"
              >
                Verify
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
    <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
      <ChevronLeft className="w-4 h-4 mr-1" /> All Users
    </Button>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {backButton}
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        {backButton}
        <p className="text-sm text-muted-foreground">User not found.</p>
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

      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{user.display_name ?? user.id}</h2>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{user.id}</p>
          </div>
          <Badge variant={getRoleBadgeVariant(topRole)}>{topRole}</Badge>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>{user.points ?? 0} points</span>
          <span>{user.submission_count ?? 0} submissions</span>
          {user.created_at && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Joined {new Date(user.created_at).toLocaleDateString()}
            </span>
          )}
          {locationParts.length > 0 && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {locationParts.join(', ')}
            </span>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold mb-3">
          Recent Submissions ({user.submissions.length}{user.submissions.length === 50 ? '+' : ''})
        </h3>
        {user.submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No submissions yet.</p>
        ) : (
          <div className="space-y-2">
            {user.submissions.map((s) => {
              const thresholds = (s.poor_brix != null && s.excellent_brix != null)
                ? { poor: s.poor_brix, average: 0, good: 0, excellent: s.excellent_brix }
                : undefined;
              const { display: displayScore, bgClass } = scoreBrix(s.brix_value, thresholds);
              return (
                <div
                  key={s.id}
                  className="border rounded p-3 flex items-start justify-between gap-3 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setSelected(s)}
                >
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="font-medium">{s.crop_label ?? s.crop_name ?? 'Unknown crop'}</div>
                    <div className="text-muted-foreground text-xs mt-0.5">
                      {(() => {
                        const loc = formatVenueLocation(s.place_street_address, s.place_city, s.place_state);
                        const label = s.place_label;
                        if (loc && label) return <>{label} <span>({loc})</span></>;
                        if (loc) return loc;
                        if (label) return label;
                        return '—';
                      })()}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(s.assessment_date).toLocaleDateString()}
                      </span>
                      {s.verified ? (
                        <span className="inline-flex items-center gap-1 text-action-primary">
                          <CheckCircle className="w-3 h-3" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gold">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`shrink-0 px-2.5 py-1 rounded-lg text-white text-sm font-bold ${bgClass}`}>
                    {displayScore}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
