import { useCallback, useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { useToast } from '@/hooks/use-toast';
import { buildSubmissionPayload } from '@/lib/buildSubmissionPayload';
import { signSubmissionPayload } from '@/lib/signSubmissionPayload';
import { retrySubmissionAnchor } from '@/lib/fetchSubmissions';
import type { BrixDataPoint } from '@/types';

/**
 * Re-signs a reading and asks the backend to anchor it again.
 *
 * Extracted from the My Readings page so the readings browser can offer the
 * same action on rows you own, rather than the two surfaces carrying separate
 * copies of the signing flow.
 */
export function useRetryAnchor() {
  const { userWallet, userPubKey } = useWallet();
  const { toast } = useToast();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const retryAnchor = useCallback(
    async (submission: BrixDataPoint) => {
      if (!userWallet || !userPubKey) {
        toast({
          title: 'Wallet not connected',
          description: 'Please log in again to retry.',
          variant: 'destructive',
        });
        return;
      }
      setRetryingId(submission.id);
      try {
        const payload = buildSubmissionPayload({
          cropName: submission.cropType,
          brixValue: submission.brixLevel,
          brandName: submission.brandName,
          notes: submission.outlier_notes,
          assessmentDate: submission.submittedAt,
          purchaseDate: submission.purchaseDate,
          latitude: submission.latitude,
          longitude: submission.longitude,
          locationName: submission.locationName,
        });
        const sig = await signSubmissionPayload(userWallet, userPubKey, payload);
        await retrySubmissionAnchor(submission.id, sig);
        toast({ title: 'Retry started', description: 'Your record will appear shortly. Refresh to check.' });
      } catch (err: any) {
        toast({ title: 'Retry failed', description: err?.message || 'Please try again.', variant: 'destructive' });
      } finally {
        setRetryingId(null);
      }
    },
    [userWallet, userPubKey, toast],
  );

  return { retryAnchor, retryingId };
}
