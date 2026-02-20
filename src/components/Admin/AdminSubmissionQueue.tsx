import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  fetchUnverifiedSubmissions,
  verifySubmission,
  deleteSubmission,
  type UnverifiedSubmission,
} from '@/lib/adminApi';

const PAGE_SIZE = 20;

export default function AdminSubmissionQueue() {
  const [submissions, setSubmissions] = useState<UnverifiedSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = async (pg = page) => {
    setLoading(true);
    try {
      const result = await fetchUnverifiedSubmissions({
        limit: PAGE_SIZE,
        offset: (pg - 1) * PAGE_SIZE,
      });
      setSubmissions(result.data);
      setTotal(result.total);
    } catch (e: any) {
      toast({
        title: 'Failed to load submissions',
        description: e?.message ?? 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    void load(newPage);
  };

  const handleVerify = async (submissionId: string) => {
    try {
      const res = await verifySubmission(submissionId, true);
      if (res.success) {
        toast({
          title: 'Submission verified',
          description: res.message ?? 'Submission has been verified and is now visible to all users.',
        });
        // Reload current page; if it becomes empty and we're not on page 1, go back
        const newTotal = total - 1;
        const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
        const targetPage = page > newTotalPages ? newTotalPages : page;
        setPage(targetPage);
        void load(targetPage);
      } else {
        toast({ title: 'Verification failed', description: res.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    }
  };

  const handleDelete = async (submissionId: string) => {
    try {
      await deleteSubmission(submissionId);
      toast({
        title: 'Submission removed',
        description: 'The submission has been permanently deleted without verification.',
      });
      const newTotal = total - 1;
      const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      const targetPage = page > newTotalPages ? newTotalPages : page;
      setPage(targetPage);
      void load(targetPage);
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Pending Verification</h2>
          <p className="text-sm text-muted-foreground">
            {total} submission{total !== 1 ? 's' : ''} awaiting review
          </p>
        </div>
        <Button variant="ghost" onClick={() => load()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {submissions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending submissions to review.</p>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <div key={s.id} className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                    Awaiting Verification
                  </Badge>
                  {s.assessment_date && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(s.assessment_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="text-sm">
                  <div className="font-medium text-base">
                    {s.crop_label ?? s.crop_name ?? 'Unknown crop'} • {s.brand_label ?? s.brand_name ?? 'Unknown brand'}
                  </div>
                  <div className="text-muted-foreground mt-1">
                    {s.place_label ?? 'Unknown place'}
                    {(s.place_city || s.place_state) && (
                      <span className="ml-1">
                        ({s.place_city ?? ''}{s.place_state ? `, ${s.place_state}` : ''})
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <span className="font-medium">Brix:</span> {s.brix_value}
                  </div>
                  <div className="text-muted-foreground mt-1">
                    <span className="font-medium">Submitted by:</span> {s.user_display_name ?? s.user_id}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 sm:flex-col sm:min-w-[180px]">
                <Button
                  size="sm"
                  onClick={() => handleVerify(s.id)}
                  className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white"
                >
                  Verify Submission
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(s.id)}
                  className="flex-1 sm:flex-none"
                >
                  Remove Without Verifying
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1 || loading}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPages || loading}
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
