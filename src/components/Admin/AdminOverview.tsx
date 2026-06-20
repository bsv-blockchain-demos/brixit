import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, ClipboardList, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchAllUsers, fetchUnverifiedSubmissions, type UserWithRoles } from '@/lib/adminApi';
import { apiGet } from '@/lib/api';

async function fetchOverviewStats() {
  const [usersResult, pendingResult, countData] = await Promise.all([
    fetchAllUsers({ limit: 100, offset: 0 }),
    fetchUnverifiedSubmissions({ limit: 1, offset: 0 }),
    apiGet<{ count: number }>('/api/submissions/count', { skipAuth: true }),
  ]);

  const adminCount = usersResult.data.filter((u: UserWithRoles) => u.roles?.includes('admin')).length;
  const contributorCount = usersResult.data.filter(
    (u: UserWithRoles) => u.roles?.includes('contributor') && !u.roles?.includes('admin')
  ).length;

  return {
    totalUsers: usersResult.total,
    adminCount,
    contributorCount,
    totalSubmissions: countData.count,
    pendingVerifications: pendingResult.total,
  };
}

// Single stat surface — white card on the canvas, big display number in deep steel.
function StatCard({ label, icon, value, children }: { label: string; icon: React.ReactNode; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="bg-card border border-hairline rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono uppercase tracking-wider text-text-muted">{label}</span>
        {icon}
      </div>
      <div className="text-3xl font-display font-bold text-blue-deep leading-none">{value}</div>
      {children}
    </div>
  );
}

export default function AdminOverview({ onReviewPending }: { onReviewPending?: () => void }) {
  const queryClient = useQueryClient();

  const { data: stats, isLoading, isFetching, error } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: fetchOverviewStats,
    staleTime: Infinity,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
  };

  const pending = stats?.pendingVerifications ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-text-dark">Overview</h2>
          <p className="text-sm text-text-mid">Live snapshot of platform data</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isFetching}
          aria-label="Refresh overview"
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-text-mid hover:text-text-dark hover:bg-surface-canvas disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{(error as any)?.message ?? 'Failed to load stats'}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Users" icon={<Users className="w-4 h-4 text-text-muted" />} value={isLoading ? '—' : stats?.totalUsers}>
          {stats && (
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-select-bg text-select-fg">
                {stats.adminCount} admin{stats.adminCount !== 1 ? 's' : ''}
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-canvas text-text-mid border border-hairline">
                {stats.contributorCount} contributor{stats.contributorCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </StatCard>

        <StatCard label="Total Submissions" icon={<ClipboardList className="w-4 h-4 text-text-muted" />} value={isLoading ? '—' : stats?.totalSubmissions}>
          <p className="text-xs text-text-mid mt-2">Verified &amp; publicly visible</p>
        </StatCard>

        <StatCard
          label="Pending Review"
          icon={pending ? <AlertCircle className="w-4 h-4 text-score-average" /> : <CheckCircle className="w-4 h-4 text-green-mid" />}
          value={isLoading ? '—' : pending}
        >
          <p className="text-xs text-text-mid mt-2">
            {pending ? 'Awaiting verification' : 'All submissions verified'}
          </p>
        </StatCard>
      </div>

      {/* Mobile: single orange CTA to the review queue */}
      {pending > 0 && (
        <button
          onClick={onReviewPending}
          className="sm:hidden w-full min-h-[44px] rounded-xl bg-action-primary hover:bg-action-primary-hover text-white font-semibold"
        >
          Review {pending} pending submission{pending !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}
