import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Calendar, CheckCircle, ChevronLeft, ChevronRight, Clock, RefreshCw, Search } from 'lucide-react';
import {
  fetchUnverifiedSubmissions,
  fetchAllSubmissions,
  verifySubmission,
  deleteSubmission,
  type UnverifiedSubmission,
  type AdminSubmission,
} from '@/lib/adminApi';
import { formatVenueLocation } from '@/lib/formatAddress';
import { formatHumanDate } from '@/lib/formatDate';
import { useCropThresholds } from '@/contexts/CropThresholdContext';
import { computeNormalizedScore } from '@/lib/getBrixColor';
import { ScoreBadge } from '@/components/common/ScoreBadge';

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

  return { handleVerify, handleDelete, invalidate };
}

// Icon-only refresh

function RefreshButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      aria-label="Refresh"
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-text-mid hover:text-text-dark hover:bg-surface-canvas disabled:opacity-50"
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

// BRIX value + score-tier pill (display only — reuses crop thresholds + normalized score)

function BrixTier({ brix, crop }: { brix: number; crop?: string | null }) {
  const { getThresholds } = useCropThresholds();
  const thresholds = crop ? getThresholds(crop) : null;
  const normalized = computeNormalizedScore(brix, thresholds);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-sm text-text-dark">{brix} BRIX</span>
      <ScoreBadge normalizedScore={normalized} size="sm" />
    </span>
  );
}

// Submission card (shared between tabs)

function SubmissionCard({
  s,
  onVerify,
  onDelete,
}: {
  s: AdminSubmission | UnverifiedSubmission;
  onVerify: (id: string, verify: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const verified = 'verified' in s ? s.verified : false;

  return (
    <div className="bg-card border border-hairline rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {verified ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-pale text-green-mid">
              <CheckCircle className="w-3 h-3" /> Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-score-average-bg text-text-dark">
              <Clock className="w-3 h-3" /> Awaiting Verification
            </span>
          )}
          {s.assessment_date && (
            <span className="text-xs text-text-muted flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatHumanDate(s.assessment_date)}
            </span>
          )}
        </div>
        <div className="text-sm">
          <div className="font-medium text-base text-text-dark">
            {s.crop_label ?? s.crop_name ?? 'Unknown crop'}{(s.brand_label ?? s.brand_name) ? ` • ${s.brand_label ?? s.brand_name}` : ''}
          </div>
          <div className="text-text-mid mt-0.5">
            {(() => {
              const loc = formatVenueLocation(s.place_street_address, s.place_city, s.place_state);
              const label = s.place_label;
              if (loc && label) return <>{label} <span className="text-text-muted">({loc})</span></>;
              if (loc) return loc;
              if (label) return label;
              return '—';
            })()}
          </div>
          <div className="mt-1.5">
            <BrixTier brix={s.brix_value} crop={s.crop_name} />
          </div>
          {'user_display_name' in s && (
            <div className="text-text-mid mt-1">
              <span className="font-medium">Submitted by:</span> {s.user_display_name ?? s.user_id}
            </div>
          )}
        </div>
      </div>

      {/* Actions: Verify = orange primary, Delete = red destructive (split by hairline on mobile) */}
      <div className="flex flex-col gap-2 sm:min-w-[180px]">
        {!verified ? (
          <button
            onClick={() => onVerify(s.id, true)}
            className="w-full min-h-[44px] rounded-xl bg-action-primary hover:bg-action-primary-hover text-white text-sm font-semibold"
          >
            Verify
          </button>
        ) : (
          <button
            onClick={() => onVerify(s.id, false)}
            className="w-full min-h-[44px] rounded-xl border border-hairline text-text-dark text-sm font-medium hover:bg-surface-canvas"
          >
            Unverify
          </button>
        )}
        <button
          onClick={() => onDelete(s.id)}
          className="w-full min-h-[44px] rounded-xl border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive/10"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// All Submissions tab

function AllSubmissionsTab() {
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

  const { handleVerify, handleDelete, invalidate } = useSubmissionActions(['admin-all-submissions', 'admin-unverified']);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { setPage(1); setCommittedSearch(search); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-mid">
          {committedSearch
            ? `${total} result${total !== 1 ? 's' : ''} for "${committedSearch}"`
            : `${total} total submission${total !== 1 ? 's' : ''}`}
        </p>
        <RefreshButton onClick={invalidate} busy={isFetching} />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <Input
          placeholder="Search by crop, place, brand or user — press Enter"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="pl-9"
        />
      </div>

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
              onDelete={(id) => handleDelete(id, total, page, setPage)}
            />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} isFetching={isFetching} onPage={setPage} />
    </div>
  );
}

// Pending tab

function PendingTab() {
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

  const { handleVerify, handleDelete, invalidate } = useSubmissionActions(['admin-unverified', 'admin-all-submissions']);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-mid">
          {total} submission{total !== 1 ? 's' : ''} awaiting review
        </p>
        <RefreshButton onClick={invalidate} busy={isFetching} />
      </div>

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
              onDelete={(id) => handleDelete(id, total, page, setPage)}
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
  return (
    <Tabs defaultValue="pending" className="space-y-4">
      {/* Steel segmented control */}
      <TabsList className="inline-flex gap-1 p-1 h-auto bg-surface-canvas border border-hairline rounded-xl">
        <TabsTrigger
          value="pending"
          className="rounded-lg px-4 py-1.5 text-sm font-medium text-text-mid data-[state=active]:bg-card data-[state=active]:text-text-dark data-[state=active]:shadow-sm"
        >
          Pending
        </TabsTrigger>
        <TabsTrigger
          value="all"
          className="rounded-lg px-4 py-1.5 text-sm font-medium text-text-mid data-[state=active]:bg-card data-[state=active]:text-text-dark data-[state=active]:shadow-sm"
        >
          All Submissions
        </TabsTrigger>
      </TabsList>
      <TabsContent value="pending" className="mt-0">
        <PendingTab />
      </TabsContent>
      <TabsContent value="all" className="mt-0">
        <AllSubmissionsTab />
      </TabsContent>
    </Tabs>
  );
}
