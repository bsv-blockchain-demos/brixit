import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
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

  const handleVerify = async (submissionId: string, value: boolean) => {
    try {
      const res = await verifySubmission(submissionId, value);
      if (res.success) {
        setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
        toast({ title: value ? 'Verified' : 'Unverified', description: res.message ?? '' });
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
        <h2 className="text-xl font-semibold">Unverified Submissions</h2>
        <Button variant="ghost" onClick={() => load()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {submissions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No unverified submissions right now.</p>
      ) : (
        <div className="space-y-2">
          {submissions.map((s) => (
            <div key={s.id} className="border rounded p-3 flex items-center justify-between">
              <div className="text-sm">
                <div className="font-medium">
                  {s.crop_label ?? s.crop_name ?? 'Unknown crop'} • {s.brand_label ?? s.brand_name ?? 'Unknown brand'}
                </div>
                <div className="text-muted-foreground">
                  {s.place_label ?? 'Unknown place'} ({s.place_city ?? ''}{s.place_state ? `, ${s.place_state}` : ''})
                </div>
                <div>Brix: {s.brix_value}</div>
                <div>By: {s.user_display_name ?? s.user_id}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleVerify(s.id, true)}>Verify</Button>
                <Button size="sm" variant="secondary" onClick={() => handleVerify(s.id, false)}>Unverify</Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(s.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
