/**
 * Resubmit view: the admin's rejection reason above an editable copy of the
 * reading, saved and cleared in one confirm.
 */
import React, { useState } from 'react';
import { BrixDataPoint } from '../../types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { AlertCircle } from 'lucide-react';
import { useWallet } from '../../contexts/WalletContext';
import { useToast } from '../ui/use-toast';
import { useStaticData } from '../../hooks/useStaticData';
import { apiPut } from '../../lib/api';
import { resubmitSubmission } from '../../lib/fetchSubmissions';
import { signSubmissionPayload } from '../../lib/signSubmissionPayload';
import SubmissionEditFields, { getDisplayLabel } from './SubmissionEditFields';
import {
  useSubmissionEditState,
  buildSubmissionUpdate,
  normalizeBrix,
  toISODateOrExisting,
} from './useSubmissionEditState';

interface ResubmitSubmissionProps {
  dataPoint: BrixDataPoint | null;
  isOpen: boolean;
  onClose: () => void;
  onResubmitSuccess: (updated: BrixDataPoint) => void;
}

const ResubmitSubmission: React.FC<ResubmitSubmissionProps> = ({
  dataPoint, isOpen, onClose, onResubmitSuccess,
}) => {
  const { ensureWallet } = useWallet();
  const { toast } = useToast();
  const { crops, brands, locations } = useStaticData();
  const editState = useSubmissionEditState(dataPoint);
  const [busy, setBusy] = useState(false);

  const handleResubmit = async () => {
    if (!dataPoint) return;

    const built = buildSubmissionUpdate({ values: editState.values, dataPoint, crops, brands, locations });
    if ('error' in built) {
      toast({ title: built.errorTitle, description: built.error, variant: 'destructive' });
      return;
    }

    setBusy(true);
    let saved = false;
    try {
      const body: Record<string, any> = { ...built.body };

      // Blank BRIX falls back to the stored reading rather than signing a zero.
      const brixToSave = normalizeBrix(editState.values.brixLevel) ?? dataPoint.brixLevel;

      // The resubmitter is always the owner and this PUT re-anchors on chain, so it
      // must be signed; acquire the wallet on demand rather than trusting context.
      const ensured = await ensureWallet().catch(() => null);
      if (!ensured) {
        toast({
          title: "Couldn't reach your wallet",
          description: 'Make sure BRIX is open inside the Mycelia app, then try again.',
          variant: 'destructive',
        });
        setBusy(false);
        return;
      }

      try {
        const sig = await signSubmissionPayload(ensured.wallet, ensured.pubKey, {
          cropName: editState.values.cropType,
          brixValue: brixToSave,
          brandName: editState.values.brand || null,
          notes: editState.values.outlierNotes || null,
          assessmentDate: toISODateOrExisting(editState.values.measurementDate, dataPoint.submittedAt),
          purchaseDate: editState.values.purchaseDate || null,
          latitude: dataPoint.latitude,
          longitude: dataPoint.longitude,
          locationName: editState.values.locationName || null,
        });
        body.payloadJson = sig.payloadJson;
        body.userSignature = sig.userSignature;
        body.userKeyID = sig.userKeyID;
        body.userIdentityKey = sig.userIdentityKey;
      } catch (sigErr: any) {
        toast({
          title: 'Signing failed',
          description: sigErr?.message || 'Please approve the signature in your wallet and try again.',
          variant: 'destructive',
        });
        setBusy(false);
        return;
      }

      // Save first: the server hashes the stored row to decide whether the reading changed.
      await apiPut(`/api/submissions/${dataPoint.id}`, body);
      saved = true;
      const updated = await resubmitSubmission(dataPoint.id);

      toast({ title: 'Sent for review', description: 'Your updated reading is back in the queue.' });
      onResubmitSuccess(updated);
      onClose();
    } catch (err: any) {
      // The PUT succeeded and only the resubmit failed, so the edit persisted.
      // The server's message carries the reason.
      const detail = err?.message || 'Please try again.';
      toast({
        title: "Couldn't send for review",
        description: saved ? `${detail} Your changes were saved.` : detail,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  if (!dataPoint) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update and resend this reading</DialogTitle>
          <DialogDescription>
            Make the changes below, then send it back for review.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-hairline bg-card p-4 flex gap-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-text-mid" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-mid">Why this needs changing</p>
            <p className="mt-1 text-sm text-text-mid">{dataPoint.rejectionMessage}</p>
          </div>
        </div>

        <SubmissionEditFields
          state={editState}
          isEditing
          dataPoint={dataPoint}
          crops={crops}
          brands={brands}
          locations={locations}
          getDisplayLabel={getDisplayLabel}
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleResubmit} disabled={busy}>
            {busy ? 'Sending...' : 'Resubmit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ResubmitSubmission;
