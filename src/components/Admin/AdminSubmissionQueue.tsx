import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Calendar } from 'lucide-react';
import {
  fetchUnverifiedSubmissions,
  verifySubmission,
  deleteSubmission,
  type UnverifiedSubmission,
} from '@/lib/adminApi';

export default function AdminSubmissionQueue() {
  const [submissions, setSubmissions] = useState<UnverifiedSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchUnverifiedSubmissions();
      setSubmissions(data);
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

  useEffect(() => {
    void load();
  }, []);

  const handleVerify = async (submissionId: string) => {
    try {
      const res = await verifySubmission(submissionId, true);
      if (res.success) {
        setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
        toast({ title: 'Approved', description: res.message ?? 'Submission has been approved.' });
      } else {
        toast({ title: 'Action failed', description: res.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    }
  };

  const handleDelete = async (submissionId: string) => {
    try {
      await deleteSubmission(submissionId);
      setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
      toast({ title: 'Deleted', description: 'Submission removed.' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Pending Verification</h2>
          <p className="text-sm text-muted-foreground">Review and approve new submissions</p>
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
                    Pending
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
              <div className="flex gap-2 sm:flex-col sm:min-w-[100px]">
                <Button 
                  size="sm" 
                  onClick={() => handleVerify(s.id)}
                  className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white"
                >
                  Approve
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive" 
                  onClick={() => handleDelete(s.id)}
                  className="flex-1 sm:flex-none"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
