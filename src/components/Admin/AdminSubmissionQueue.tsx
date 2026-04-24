import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

// Pagination bar

function Pagination({ page, totalPages, isFetching, onPage }: {
  page: number; totalPages: number; isFetching: boolean; onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-2">
      <Button variant="outline" size="sm" onClick={() => onPage(page - 1)} disabled={page === 1 || isFetching}>
        <ChevronLeft className="w-4 h-4 mr-1" /> Previous
      </Button>
      <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
      <Button variant="outline" size="sm" onClick={() => onPage(page + 1)} disabled={page === totalPages || isFetching}>
        Next <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
}

// Submission card (shared between tabs)

function SubmissionCard({
  s,
  showVerifyToggle,
  onVerify,
  onDelete,
}: {
  s: AdminSubmission | UnverifiedSubmission;
  showVerifyToggle: boolean;
  onVerify: (id: string, verify: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const verified = 'verified' in s ? s.verified : false;

  return (
    <div className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          {verified ? (
            <Badge variant="outline" className="bg-blue-mist text-action-primary border-blue-pale flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Verified
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-blue-mist text-gold border-blue-pale flex items-center gap-1">
              <Clock className="w-3 h-3" /> Awaiting Verification
            </Badge>
          )}
          {s.assessment_date && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(s.assessment_date).toLocaleDateString()}
            </span>
          )}
        </div>
        <div className="text-sm">
          <div className="font-medium text-base">
            {s.crop_label ?? s.crop_name ?? 'Unknown crop'}{(s.brand_label ?? s.brand_name) ? ` • ${s.brand_label ?? s.brand_name}` : ''}
          </div>
          <div className="text-muted-foreground mt-0.5">
            {(() => {
              const loc = formatVenueLocation(s.place_street_address, s.place_city, s.place_state);
              const label = s.place_label;
              if (loc && label) return <>{label} <span className="text-muted-foreground">({loc})</span></>;
              if (loc) return loc;
              if (label) return label;
              return '—';
            })()}
          </div>
          <div className="mt-0.5">
            <span className="font-medium">Brix:</span> {s.brix_value}
          </div>
          {'user_display_name' in s && (
            <div className="text-muted-foreground mt-0.5">
              <span className="font-medium">Submitted by:</span> {s.user_display_name ?? s.user_id}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 sm:flex-col sm:min-w-[180px]">
        {showVerifyToggle && !verified && (
          <Button size="sm" onClick={() => onVerify(s.id, true)} className="flex-1 sm:flex-none bg-action-primary hover:bg-action-primary-hover text-white">
            Verify
          </Button>
        )}
        {showVerifyToggle && verified && (
          <Button size="sm" variant="outline" onClick={() => onVerify(s.id, false)} className="flex-1 sm:flex-none">
            Unverify
          </Button>
        )}
        <Button size="sm" variant="destructive" onClick={() => onDelete(s.id)} className="flex-1 sm:flex-none">
          Delete
        </Button>
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {committedSearch
            ? `${total} result${total !== 1 ? 's' : ''} for "${committedSearch}"`
            : `${total} total submission${total !== 1 ? 's' : ''}`}
        </p>
        <Button variant="ghost" onClick={invalidate} disabled={isFetching} className="flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by crop, place, brand or user — press Enter"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : submissions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {committedSearch ? 'No submissions match your search.' : 'No submissions found.'}
        </p>
      ) : (
        <div className={`space-y-3 ${isFetching ? 'opacity-60 pointer-events-none' : ''}`}>
          {submissions.map((s) => (
            <SubmissionCard
              key={s.id}
              s={s}
              showVerifyToggle
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} submission{total !== 1 ? 's' : ''} awaiting review
        </p>
        <Button variant="ghost" onClick={invalidate} disabled={isFetching} className="flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : submissions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending submissions to review.</p>
      ) : (
        <div className={`space-y-3 ${isFetching ? 'opacity-60 pointer-events-none' : ''}`}>
          {submissions.map((s) => (
            <SubmissionCard
              key={s.id}
              s={{ ...s, verified: false } as AdminSubmission}
              showVerifyToggle
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
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Submissions</h2>
      </div>
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="all">All Submissions</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
          <PendingTab />
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          <AllSubmissionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
