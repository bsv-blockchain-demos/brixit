import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';
import { Users, ClipboardList, CheckCircle, Clock, RefreshCw, Stamp } from 'lucide-react';
import { CountUp } from '@/components/common/IconStatGrid';
import { fetchAllUsers, fetchUnverifiedSubmissions, type UserWithRoles } from '@/lib/adminApi';
import { fetchPendingSubmissions } from '@/lib/adminWalletApi';
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

  // Optional — the wallet endpoint shouldn't break the whole overview if it fails.
  let pendingAnchors = 0;
  try {
    pendingAnchors = (await fetchPendingSubmissions({ limit: 1 })).total;
  } catch {
    pendingAnchors = 0;
  }

  return {
    totalUsers: usersResult.total,
    adminCount,
    contributorCount,
    totalSubmissions: countData.count,
    pendingVerifications: pendingResult.total,
    pendingAnchors,
  };
}

// Animated stat surface: staggered entrance, pointer-tilt 3D, hover lift, a
// glossy accent badge, count-up value, and a ghosted corner watermark. Mirrors
// the My Data stat cards. All motion is disabled under prefers-reduced-motion.
function StatCard({
  index,
  label,
  icon: Icon,
  accentBg,
  accentGhost,
  value,
  children,
}: {
  index: number;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accentBg: string;
  accentGhost: string;
  value: React.ReactNode;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(rx, { stiffness: 220, damping: 18 });
  const rotateY = useSpring(ry, { stiffness: 220, damping: 18 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduce) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    ry.set(px * 8);
    rx.set(-py * 8);
  };
  const reset = () => { rx.set(0); ry.set(0); };

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      whileHover={reduce ? undefined : { y: -4 }}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      className="group relative overflow-hidden bg-card border border-hairline rounded-2xl shadow-sm hover:shadow-xl transition-shadow duration-300 p-5 will-change-transform"
    >
      {/* Faint oversized echo of the icon, anchored bottom-right for depth */}
      <Icon aria-hidden className={`pointer-events-none absolute -bottom-5 -right-4 w-28 h-28 ${accentGhost} opacity-[0.06] group-hover:opacity-[0.1] transition-opacity duration-500`} />
      {/* soft sheen that lifts on hover */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-32 w-32 rounded-full bg-blue-light/0 group-hover:bg-blue-light/15 blur-2xl transition-colors duration-500" />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-text-muted">{label}</span>
          <span className={`relative inline-flex items-center justify-center w-11 h-11 rounded-2xl ${accentBg} shadow-lg ring-1 ring-white/15 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3`}>
            <span aria-hidden className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/25 to-transparent" />
            <Icon className="relative w-5 h-5 text-white" />
          </span>
        </div>
        <div className="text-3xl font-display font-bold text-blue-deep leading-none tabular-nums">
          {typeof value === 'number' ? <CountUp value={value} /> : value}
        </div>
        {children}
      </div>
    </motion.div>
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
  const anchors = stats?.pendingAnchors ?? 0;

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard index={0} label="Total Users" icon={Users} accentBg="bg-blue-deep" accentGhost="text-blue-deep" value={isLoading ? '-' : stats?.totalUsers}>
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

        <StatCard index={1} label="Total Submissions" icon={ClipboardList} accentBg="bg-green-mid" accentGhost="text-green-mid" value={isLoading ? '-' : stats?.totalSubmissions}>
          <p className="text-xs text-text-mid mt-2">Verified &amp; publicly visible</p>
        </StatCard>

        <StatCard
          index={2}
          label="Pending Review"
          icon={pending ? Clock : CheckCircle}
          accentBg={pending ? 'bg-gold' : 'bg-green-mid'}
          accentGhost={pending ? 'text-gold' : 'text-green-mid'}
          value={isLoading ? '-' : pending}
        >
          <p className="text-xs text-text-mid mt-2">
            {pending ? 'Awaiting verification' : 'All submissions verified'}
          </p>
        </StatCard>

        <StatCard
          index={3}
          label="Pending Blockchain Records"
          icon={Stamp}
          accentBg={anchors ? 'bg-badge-neutral-text' : 'bg-green-mid'}
          accentGhost={anchors ? 'text-badge-neutral-text' : 'text-green-mid'}
          value={isLoading ? '-' : anchors}
        >
          <p className="text-xs text-text-mid mt-2">
            {anchors ? 'Awaiting blockchain confirmation' : 'All submissions timestamped'}
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
