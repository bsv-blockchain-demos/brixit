import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Ban, Calendar, Check, CheckCircle, ChevronLeft, ChevronRight, Clock, Loader2, MapPin, RefreshCw, RotateCcw, Search, Trash2, User } from 'lucide-react';
import {
  fetchUnverifiedSubmissions,
  fetchAllSubmissions,
  verifySubmission,
  rejectSubmission,
  deleteSubmission,
  type UnverifiedSubmission,
  type AdminSubmission,
} from '@/lib/adminApi';
import { useFormattedSubmissionByIdQuery } from '@/hooks/useSubmissions';
import DataPointDetailModal from '@/components/common/DataPointDetailModal';
import { formatVenueLocation } from '@/lib/formatAddress';
import { formatHumanDate } from '@/lib/formatDate';
import { useCropThresholds } from '@/contexts/CropThresholdContext';
import { scoreBrix } from '@/lib/getBrixColor';
import { titleCase } from '@/lib/titleCase';
import { VerifiedBadge, BlockchainBadge } from '@/components/common/StatusBadges';

const PAGE_SIZE = 20;

// Shared action handlers

function useSubmissionActions(invalidateKeys: string[]) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () =>
    invalidateKeys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));

  const handleVerify = async (submissionId: string, verify: boolean, total: number, page: number, setPage: (p: number) => void) => {
    try {
      const res = await verifySubmission(submissionId, verify);
      if (res.success) {
        toast({ title: verify ? 'Submission verified' : 'Submission unverified' });
        if (verify) {
          const newTotalPages = Math.max(1, Math.ceil((total - 1) / PAGE_SIZE));
          if (page > newTotalPages) setPage(newTotalPages);
        }
        invalidate();
      } else {
        toast({ title: 'Action failed', description: res.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    }
  };

  const handleDelete = async (submissionId: string, total: number, page: number, setPage: (p: number) => void) => {
    try {
      await deleteSubmission(submissionId);
      toast({ title: 'Submission deleted' });
      const newTotalPages = Math.max(1, Math.ceil((total - 1) / PAGE_SIZE));
      if (page > newTotalPages) setPage(newTotalPages);
      invalidate();
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    }
  };

  // Soft decline (reject=true) or restore to pending (reject=false). Either way
  // the item leaves the current list, so adjust the page like verify/delete do.
  const handleReject = async (submissionId: string, reject: boolean, total: number, page: number, setPage: (p: number) => void) => {
    try {
      const res = await rejectSubmission(submissionId, reject);
      if (res.success) {
        toast({ title: reject ? 'Submission rejected' : 'Submission restored to pending' });
        const newTotalPages = Math.max(1, Math.ceil((total - 1) / PAGE_SIZE));
        if (page > newTotalPages) setPage(newTotalPages);
        invalidate();
      } else {
        toast({ title: 'Action failed', description: res.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    }
  };

  return { handleVerify, handleDelete, handleReject, invalidate };
}

// Header refresh — icon-only on mobile, labelled on desktop

function HeaderRefresh({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      aria-label="Refresh"
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-text-mid hover:text-text-dark hover:bg-surface-canvas disabled:opacity-50 shrink-0"
    >
      <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
    </button>
  );
}

// Pagination bar

function Pagination({ page, totalPages, isFetching, onPage }: {
  page: number; totalPages: number; isFetching: boolean; onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-2">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 1 || isFetching}
        className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg border border-hairline text-sm text-text-dark hover:bg-surface-canvas disabled:opacity-50"
      >
        <ChevronLeft className="w-4 h-4" /> Previous
      </button>
      <span className="text-sm text-text-mid">Page {page} of {totalPages}</span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages || isFetching}
        className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg border border-hairline text-sm text-text-dark hover:bg-surface-canvas disabled:opacity-50"
      >
        Next <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// Tier-colored score box (BRIX value, colored by the crop-relative tier)

function ScoreBlock({ brix, crop, size = 'lg' }: { brix: number; crop?: string | null; size?: 'lg' | 'md' }) {
  const { getThresholds } = useCropThresholds();
  const { bgClass } = scoreBrix(brix, crop ? getThresholds(crop) : null);
  return (
    <div
      className={`inline-flex flex-col items-center justify-center rounded-2xl text-white ${bgClass} ${
        size === 'lg' ? 'px-4 py-3 min-w-[78px]' : 'px-3 py-2 min-w-[64px]'
      }`}
    >
      <span className={`font-display font-bold leading-none ${size === 'lg' ? 'text-3xl' : 'text-2xl'}`}>{brix}</span>
      <span className="mt-1 text-2xs font-semibold tracking-[0.16em] uppercase opacity-90">BRIX</span>
    </div>
  );
}

// Crop-relative rating dot-pill (Excellent / Good / Average / Poor)

const RATING_PILL: Record<string, string> = {
  Excellent: 'bg-score-excellent-bg text-score-excellent',
  Good: 'bg-score-good-bg text-score-good',
  Average: 'bg-score-average-bg text-score-average',
  Poor: 'bg-score-poor-bg text-score-poor',
};

function RatingPill({ brix, crop }: { brix: number; crop?: string | null }) {
  const { getThresholds } = useCropThresholds();
  const { quality, hex } = scoreBrix(brix, crop ? getThresholds(crop) : null);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${RATING_PILL[quality]}`}
      aria-label={`Brix score ${brix}, rated ${quality}`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hex }} aria-hidden />
      {quality}
    </span>
  );
}

// Verification status chip — shared badge so it matches the public tables/cards.

function StatusChip({ verified, timestamped, rejected }: { verified: boolean; timestamped: boolean; rejected?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {rejected ? (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap bg-score-poor-bg text-score-poor">
          <Ban className="w-3.5 h-3.5" /> Rejected
        </span>
      ) : (
        <VerifiedBadge verified={verified} />
      )}
      <BlockchainBadge secured={timestamped} />
    </span>
  );
}

// Submission card (shared between tabs; distinct desktop + mobile layouts)

function SubmissionCard({
  s,
  onVerify,
  onReject,
  onDelete,
  onOpen,
}: {
  s: AdminSubmission | UnverifiedSubmission;
  onVerify: (id: string, verify: boolean) => void;
  onReject: (id: string, reject: boolean) => void;
  onDelete: (id: string) => void;
  onOpen: () => void;
}) {
  const verified = 'verified' in s ? s.verified : false;
  const rejected = !!s.rejected;
  const cropName = titleCase(s.crop_label ?? s.crop_name) || 'Unknown crop';
  const brand = s.brand_label ?? s.brand_name;
  const loc = formatVenueLocation(s.place_street_address, s.place_city, s.place_state);
  const locationText = [s.place_label, loc].filter(Boolean).join(' · ') || '-';
  const userName = 'user_display_name' in s ? (s.user_display_name ?? s.user_id) : null;

  const title = (
    <span className="text-base">
      <span className="font-semibold text-text-dark">{cropName}</span>
      {brand && <span className="text-text-mid"> · {brand}</span>}
    </span>
  );

  const meta = (
    <div className="space-y-1.5 text-sm">
      <div className="flex items-start gap-1.5 text-text-mid">
        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-text-muted" />
        <span className="min-w-0">{locationText}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-text-muted">
        {s.assessment_date && (
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> {formatHumanDate(s.assessment_date)}
          </span>
        )}
        {userName && (
          <span className="inline-flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> {userName}
          </span>
        )}
      </div>
    </div>
  );

  const verifyBtn = (
    <button
      onClick={(e) => { e.stopPropagation(); onVerify(s.id, true); }}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-fresh hover:bg-green-mid text-white text-sm font-semibold"
    >
      <Check className="w-4 h-4" /> Verify
    </button>
  );

  const unverifyBtn = (
    <button
      onClick={(e) => { e.stopPropagation(); onVerify(s.id, false); }}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-hairline text-text-dark text-sm font-medium hover:bg-surface-canvas"
    >
      Unverify
    </button>
  );

  // Reject is a reversible soft decline (amber), distinct from the destructive Delete (red).
  const rejectBtn = (
    <button
      onClick={(e) => { e.stopPropagation(); onReject(s.id, true); }}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-hairline text-score-average text-sm font-medium hover:bg-score-average-bg"
    >
      <Ban className="w-4 h-4" /> Reject
    </button>
  );

  const restoreBtn = (
    <button
      onClick={(e) => { e.stopPropagation(); onReject(s.id, false); }}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-hairline text-blue-mid text-sm font-medium hover:bg-surface-canvas"
    >
      <RotateCcw className="w-4 h-4" /> Restore
    </button>
  );

  const deleteBtn = (
    <button
      onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-hairline text-action-danger text-sm font-medium hover:bg-score-poor-bg"
    >
      <Trash2 className="w-4 h-4" /> Delete
    </button>
  );

  // Pending → Verify · Reject · Delete. Rejected → Restore · Delete. Verified → Unverify · Delete.
  const actions = rejected
    ? <>{restoreBtn}{deleteBtn}</>
    : verified
      ? <>{unverifyBtn}{deleteBtn}</>
      : <>{verifyBtn}{rejectBtn}{deleteBtn}</>;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      className="bg-card border border-hairline rounded-2xl shadow-sm overflow-hidden cursor-pointer transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-light"
    >
      {/* Desktop: score column · details · actions */}
      <div className="hidden sm:flex items-center gap-5 p-4">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <ScoreBlock brix={s.brix_value} crop={s.crop_name} />
          <RatingPill brix={s.brix_value} crop={s.crop_name} />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {title}
            <StatusChip verified={verified} timestamped={!!s.timestamped} rejected={rejected} />
          </div>
          {meta}
        </div>
        <div className="flex items-center gap-2 shrink-0 [&>button]:h-9 [&>button]:px-4">
          {actions}
        </div>
      </div>

      {/* Mobile: stacked, score top-right, full-width orange action bar */}
      <div className="sm:hidden">
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">{title}</div>
            <div className="flex flex-col items-center gap-2 shrink-0">
              <ScoreBlock brix={s.brix_value} crop={s.crop_name} size="md" />
              <RatingPill brix={s.brix_value} crop={s.crop_name} />
            </div>
          </div>
          <div>
            <StatusChip verified={verified} timestamped={!!s.timestamped} rejected={rejected} />
          </div>
          {meta}
        </div>
        <div className="px-4 pb-4 space-y-2 [&>button]:w-full [&>button]:h-11">
          {actions}
        </div>
      </div>
    </div>
  );
}

// All Submissions tab

function AllSubmissionsTab({ onOpenDetail }: { onOpenDetail: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-all-submissions', committedSearch, page],
    queryFn: () => fetchAllSubmissions({ search: committedSearch || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    placeholderData: (prev) => prev,
    staleTime: Infinity,
  });

  const submissions = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { handleVerify, handleReject, handleDelete } = useSubmissionActions(['admin-all-submissions', 'admin-unverified', 'admin-rejected']);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { setPage(1); setCommittedSearch(search); }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <Input
          placeholder="Search by crop, place, brand or user, press Enter"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="pl-9"
        />
      </div>

      <p className="text-sm text-text-mid">
        {committedSearch
          ? `${total} result${total !== 1 ? 's' : ''} for "${committedSearch}"`
          : `${total} total submission${total !== 1 ? 's' : ''}`}
      </p>

      {isLoading ? (
        <p className="text-sm text-text-mid">Loading...</p>
      ) : submissions.length === 0 ? (
        <p className="text-sm text-text-mid">
          {committedSearch ? 'No submissions match your search.' : 'No submissions found.'}
        </p>
      ) : (
        <div className={`space-y-3 ${isFetching ? 'opacity-60 pointer-events-none' : ''}`}>
          {submissions.map((s) => (
            <SubmissionCard
              key={s.id}
              s={s}
              onVerify={(id, verify) => handleVerify(id, verify, total, page, setPage)}
              onReject={(id, reject) => handleReject(id, reject, total, page, setPage)}
              onDelete={(id) => handleDelete(id, total, page, setPage)}
              onOpen={() => onOpenDetail(s.id)}
            />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} isFetching={isFetching} onPage={setPage} />
    </div>
  );
}

// Pending tab

function PendingTab({ onOpenDetail }: { onOpenDetail: (id: string) => void }) {
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-unverified', page],
    queryFn: () => fetchUnverifiedSubmissions({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    placeholderData: (prev) => prev,
    staleTime: Infinity,
  });

  const submissions = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { handleVerify, handleReject, handleDelete } = useSubmissionActions(['admin-unverified', 'admin-all-submissions', 'admin-rejected']);

  return (
    <div className="space-y-4">
      {isLoading ? (
        <p className="text-sm text-text-mid">Loading...</p>
      ) : submissions.length === 0 ? (
        <p className="text-sm text-text-mid">No pending submissions to review.</p>
      ) : (
        <div className={`space-y-3 ${isFetching ? 'opacity-60 pointer-events-none' : ''}`}>
          {submissions.map((s) => (
            <SubmissionCard
              key={s.id}
              s={{ ...s, verified: false } as AdminSubmission}
              onVerify={(id, verify) => handleVerify(id, verify, total, page, setPage)}
              onReject={(id, reject) => handleReject(id, reject, total, page, setPage)}
              onDelete={(id) => handleDelete(id, total, page, setPage)}
              onOpen={() => onOpenDetail(s.id)}
            />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} isFetching={isFetching} onPage={setPage} />
    </div>
  );
}

// Rejected tab: declined readings, kept for audit and restorable

function RejectedTab({ onOpenDetail }: { onOpenDetail: (id: string) => void }) {
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-rejected', page],
    queryFn: () => fetchAllSubmissions({ rejected: true, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    placeholderData: (prev) => prev,
    staleTime: Infinity,
  });

  const submissions = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { handleVerify, handleReject, handleDelete } = useSubmissionActions(['admin-rejected', 'admin-unverified', 'admin-all-submissions']);

  return (
    <div className="space-y-4">
      {isLoading ? (
        <p className="text-sm text-text-mid">Loading...</p>
      ) : submissions.length === 0 ? (
        <p className="text-sm text-text-mid">No rejected submissions.</p>
      ) : (
        <div className={`space-y-3 ${isFetching ? 'opacity-60 pointer-events-none' : ''}`}>
          {submissions.map((s) => (
            <SubmissionCard
              key={s.id}
              s={s}
              onVerify={(id, verify) => handleVerify(id, verify, total, page, setPage)}
              onReject={(id, reject) => handleReject(id, reject, total, page, setPage)}
              onDelete={(id) => handleDelete(id, total, page, setPage)}
              onOpen={() => onOpenDetail(s.id)}
            />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} isFetching={isFetching} onPage={setPage} />
    </div>
  );
}

// Root component

export default function AdminSubmissionQueue() {
  const [tab, setTab] = useState<'pending' | 'all' | 'rejected'>('pending');
  const queryClient = useQueryClient();

  // Click-to-expand: fetch the full submission by id (works for unverified too)
  // and show it in the shared detail modal (desktop) / full-screen page (mobile).
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailQuery = useFormattedSubmissionByIdQuery(detailId ?? undefined, { enabled: !!detailId });

  // Pending head: shares the page-1 cache key with PendingTab, so the badge /
  // eyebrow / side-count always reflect the awaiting-review total.
  const { data: pendingHead, isFetching: headFetching } = useQuery({
    queryKey: ['admin-unverified', 1],
    queryFn: () => fetchUnverifiedSubmissions({ limit: PAGE_SIZE, offset: 0 }),
    staleTime: Infinity,
  });
  const pendingCount = pendingHead?.total ?? 0;

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-unverified'] });
    queryClient.invalidateQueries({ queryKey: ['admin-all-submissions'] });
    queryClient.invalidateQueries({ queryKey: ['admin-rejected'] });
  };

  return (
    <>
    <Tabs value={tab} onValueChange={(v) => setTab(v as 'pending' | 'all' | 'rejected')} className="space-y-5">
      {/* Section header */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-display font-bold text-text-dark">Submissions</h2>
          <p className="text-sm text-text-mid">Review community readings before they go public</p>
        </div>
        <HeaderRefresh onClick={refreshAll} busy={headFetching} />
      </header>

      {/* Segmented control + awaiting count */}
      <div className="flex items-center justify-between gap-3">
        <TabsList className="inline-flex w-full sm:w-auto gap-1 p-1 h-auto bg-surface-canvas border border-hairline rounded-xl">
          <TabsTrigger
            value="pending"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-lg border-b-0 mb-0 px-4 py-2 text-sm font-medium text-blue-mid data-[state=active]:bg-card data-[state=active]:text-card-foreground data-[state=active]:border data-[state=active]:border-blue-light data-[state=active]:shadow-sm"
          >
            Pending
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-deep text-foreground text-xs font-semibold">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="rejected"
            className="flex-1 sm:flex-initial rounded-lg border-b-0 mb-0 px-4 py-2 text-sm font-medium text-blue-mid data-[state=active]:bg-card data-[state=active]:text-card-foreground data-[state=active]:border data-[state=active]:border-blue-light data-[state=active]:shadow-sm"
          >
            Rejected
          </TabsTrigger>
          <TabsTrigger
            value="all"
            className="flex-1 sm:flex-initial rounded-lg border-b-0 mb-0 px-4 py-2 text-sm font-medium text-blue-mid data-[state=active]:bg-card data-[state=active]:text-card-foreground data-[state=active]:border data-[state=active]:border-blue-light data-[state=active]:shadow-sm"
          >
            <span className="sm:hidden">All</span>
            <span className="hidden sm:inline">All Submissions</span>
          </TabsTrigger>
        </TabsList>
        {tab === 'pending' && (
          <span className="hidden sm:block text-sm text-text-mid whitespace-nowrap">
            {pendingCount} awaiting review
          </span>
        )}
      </div>

      <TabsContent value="pending" className="mt-0">
        <PendingTab onOpenDetail={setDetailId} />
      </TabsContent>
      <TabsContent value="rejected" className="mt-0">
        <RejectedTab onOpenDetail={setDetailId} />
      </TabsContent>
      <TabsContent value="all" className="mt-0">
        <AllSubmissionsTab onOpenDetail={setDetailId} />
      </TabsContent>
    </Tabs>

    {/* Loading veil while the full submission is fetched by id */}
    {detailId && detailQuery.isLoading && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-sm">
        <Loader2 className="h-6 w-6 animate-spin text-white" />
      </div>
    )}

    {/* Expanded detail: desktop modal, mobile full-screen page (component decides) */}
    <DataPointDetailModal
      dataPoint={detailQuery.data ?? null}
      isOpen={!!detailId && !!detailQuery.data}
      onClose={() => setDetailId(null)}
      onDeleteSuccess={() => { setDetailId(null); refreshAll(); }}
      onUpdateSuccess={() => { refreshAll(); }}
    />
    </>
  );
}
