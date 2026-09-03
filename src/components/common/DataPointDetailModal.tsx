import React, { useState, useEffect } from 'react';
import { BrixDataPoint } from '../../types';
import { useMaxWidth } from '@/hooks/use-mobile';
import { VerifiedBadge, BlockchainBadge } from './StatusBadges';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Drawer, DrawerContent, DrawerTitle } from '../ui/drawer';
import {
  ArrowLeft,
  User,
  CheckCircle,
  AlertCircle,
  Ban,
  RotateCcw,
  Trash2,
  Image as ImageIcon,
  Loader2,
  Edit,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWallet } from '../../contexts/WalletContext';
import { signSubmissionPayload } from '../../lib/signSubmissionPayload';
import { deleteSubmission } from '../../lib/fetchSubmissions';
import { verifySubmission, rejectSubmission } from '../../lib/adminApi';
import RejectSubmissionDialog from '../Admin/RejectSubmissionDialog';
import { useToast } from '../ui/use-toast';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { apiPut } from '../../lib/api';
import { useImageUrls } from '../../hooks/useImageUrls';
import { formatUsername } from '../../lib/formatUsername';
import { gradeBrix } from '../../lib/getBrixColor';
import { RefractometerReading } from './RefractometerReading';
import { useCropThresholds } from '../../contexts/CropThresholdContext';
import { useStaticData } from '../../hooks/useStaticData';
import SubmissionEditFields, { DetailSection, DetailRow, getDisplayLabel } from './SubmissionEditFields';
import {
  useSubmissionEditState,
  buildSubmissionUpdate,
  normalizeBrix,
  toISODateOrExisting,
} from './useSubmissionEditState';

// Mobile detail breakpoint: ≤640px renders a full-screen page (no modal/overlay);
interface DataPointDetailModalProps {
  dataPoint: BrixDataPoint | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleteSuccess?: (id: string) => void;
  onUpdateSuccess?: (dataPoint: BrixDataPoint) => void;
  initialEditMode?: boolean;
  /**
   * 'page' renders the content bare, for a route that supplies its own header
   * and breadcrumbs. 'auto' keeps the overlay: a bottom sheet on mobile, a
   * dialog on desktop.
   */
  presentation?: 'auto' | 'page';
}

const DataPointDetailModal: React.FC<DataPointDetailModalProps> = ({
  dataPoint: initialDataPoint,
  isOpen,
  onClose,
  onDeleteSuccess,
  onUpdateSuccess,
  presentation = 'auto',
  initialEditMode = false,
}) => {
  const { isAdmin, user } = useAuth();
  const { userWallet, userPubKey } = useWallet();
  const { toast } = useToast();
  const { getThresholds } = useCropThresholds();
  const isMobilePage = useMaxWidth(640);

  // Lock background scroll while the mobile full-page detail is open.
  useEffect(() => {
    if (!isMobilePage || !isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isMobilePage, isOpen]);

  // Use the shared static data hook and destructure the new 'locations' property
  const { crops, brands, locations, isLoading: staticDataLoading, error: staticDataError } = useStaticData();

  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Image URLs come from a React Query cache keyed by submission id so the
  // same submission viewed from different surfaces reuses the same fetch.
  const imageKeys = React.useMemo(
    () =>
      Array.isArray(initialDataPoint?.images)
        ? initialDataPoint!.images.filter((k): k is string => typeof k === 'string' && k.length > 0)
        : [],
    [initialDataPoint],
  );
  const imageUrlsQuery = useImageUrls(initialDataPoint?.id, imageKeys);
  const imageUrls = imageUrlsQuery.data ?? [];
  const imagesLoading = imageUrlsQuery.isLoading;

  // Remove the isLoading state since we're using staticDataLoading
  const [isInitializing, setIsInitializing] = useState(true);

  // State for form data
  const editState = useSubmissionEditState(initialDataPoint);
  const { brixLevel, cropType, variety, brand, locationName, measurementDate, purchaseDate, outlierNotes } = editState.values;
  const { setBrixLevel, setCropType, setVariety, setBrand, setLocationName, setMeasurementDate, setPurchaseDate, setOutlierNotes } = editState.setters;
  const [placeName, setPlaceName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [verified, setVerified] = useState(false);
  const [verifiedBy, setVerifiedBy] = useState('');
  const [verifiedAt, setVerifiedAt] = useState('');

  useEffect(() => {
    async function initializeModalData() {
      // Keep: the hook's reset has no isOpen awareness, so only this block
      // clears the form on close. It also normalises dates differently.
      if (!isOpen || !initialDataPoint) {
        setIsInitializing(false);
        // Reset state when modal is not open to prepare for next opening
        setBrixLevel('');
        setCropType('');
        setVariety('');
        setPlaceName('');
        setLocationName('');
        setLatitude(null);
        setLongitude(null);
        setMeasurementDate('');
        setPurchaseDate('');
        setOutlierNotes('');
        setBrand('');
        setVerified(false);
        setVerifiedBy('');
        setVerifiedAt('');
        setError(null);
        setIsEditing(false);
        return;
      }

      setIsEditing(initialEditMode);
      setIsInitializing(true);

      try {
        // Populate form state from prop immediately
        setBrixLevel(initialDataPoint.brixLevel ?? '');
        setCropType(initialDataPoint.cropType || '');
        setVariety(initialDataPoint.variety || '');
        setPlaceName(initialDataPoint.placeName || '');
        setLocationName(initialDataPoint.locationName || '');
        setLatitude(initialDataPoint.latitude ?? null);
        setLongitude(initialDataPoint.longitude ?? null);
        setMeasurementDate(initialDataPoint.submittedAt ? new Date(initialDataPoint.submittedAt).toISOString().split('T')[0] : '');
        setPurchaseDate(initialDataPoint.purchaseDate || '');
        setOutlierNotes(initialDataPoint.outlier_notes || '');
        setBrand(initialDataPoint.brandName || '');
        setVerified(initialDataPoint.verified ?? false);
        setVerifiedBy(initialDataPoint.verifiedBy || '');
        setVerifiedAt(initialDataPoint.verifiedAt || '');

        if (staticDataError) {
          setError(staticDataError);
        }

        setIsInitializing(false);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Error during modal initialization:', err);
        setError(`Modal initialization failed: ${message}`);
        setIsInitializing(false);
      }
    }
    initializeModalData();
  }, [isOpen, initialDataPoint, initialEditMode, staticDataError, staticDataLoading, crops, brands, locations]);

  const handleDelete = async () => {
    if (!initialDataPoint) return;

    setIsDeleting(true);
    try {
      const success = await deleteSubmission(initialDataPoint.id);
      if (success) {
        toast({
          title: 'Success',
          description: 'Reading deleted successfully',
        });
        onDeleteSuccess?.(initialDataPoint.id);
        onClose();
      } else {
        throw new Error('Delete operation failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete reading',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Admin moderation (decoupled from edit): approve or revert via the dedicated
  // admin verify endpoint. Editing the reading itself stays owner-only.
  const handleSetVerified = async (next: boolean) => {
    if (!initialDataPoint) return;
    setVerifying(true);
    try {
      const res = await verifySubmission(initialDataPoint.id, next);
      if (res?.success) {
        setVerified(next);
        const nextVerifiedAt = next ? new Date().toISOString() : null;
        setVerifiedAt(nextVerifiedAt ?? '');
        toast({ title: next ? 'Reading verified' : 'Reading rejected' });
        onUpdateSuccess?.({ ...initialDataPoint, verified: next, verifiedAt: nextVerifiedAt });
      } else {
        toast({ title: 'Action failed', description: res?.error ?? 'Please try again.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  };

  // Soft decline: keeps the record (reversible from the admin Rejected tab),
  // distinct from permanent Delete. Closes the modal and refreshes the lists.
  // Always called from RejectSubmissionDialog — the reason is required.
  const handleRejectSubmission = async (message: string) => {
    if (!initialDataPoint) return;
    setRejecting(true);
    try {
      const res = await rejectSubmission(initialDataPoint.id, true, message);
      if (res?.success) {
        toast({ title: 'Reading rejected' });
        onUpdateSuccess?.({ ...initialDataPoint, verified: false, rejected: true, rejectionMessage: message });
        onClose();
      } else {
        toast({ title: 'Action failed', description: res?.error ?? 'Please try again.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setRejecting(false);
    }
  };

  // Back to pending, via the reject endpoint with reject: false. Needs no message.
  const handleRestoreSubmission = async () => {
    if (!initialDataPoint) return;
    setRejecting(true);
    try {
      const res = await rejectSubmission(initialDataPoint.id, false);
      if (res?.success) {
        toast({ title: 'Reading restored to pending' });
        onUpdateSuccess?.({ ...initialDataPoint, rejected: false, rejectionMessage: null });
        onClose();
      } else {
        toast({ title: 'Action failed', description: res?.error ?? 'Please try again.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'Please try again.', variant: 'destructive' });
    } finally {
      setRejecting(false);
    }
  };

  const handleSave = async () => {
    console.log('=== SAVE OPERATION DEBUG ===');
    console.log('Starting save operation...');
    console.log('initialDataPoint:', initialDataPoint);
    console.log('Form state:', { brixLevel, cropType, variety, placeName, locationName, latitude, longitude, measurementDate, purchaseDate, outlierNotes, brand, verified });
    console.log('Static data:', { crops, brands, locations }); // Updated log name

    if (!initialDataPoint) {
      console.error('No initialDataPoint available for save operation');
      return;
    }

    // Normalize and validate BRIX
    const newBrix = normalizeBrix(brixLevel);
    const brixToSave = newBrix ?? initialDataPoint.brixLevel;

    if (!Number.isFinite(brixToSave)) {
      toast({
        title: 'Invalid BRIX value',
        description: 'Please enter a valid number for BRIX.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      console.log('Looking for matching items in static data...');

      const built = buildSubmissionUpdate({
        values: editState.values,
        dataPoint: initialDataPoint,
        crops,
        brands,
        locations,
      });

      if ('error' in built) {
        toast({
          title: built.errorTitle,
          description: built.error,
          variant: 'destructive',
        });
        setSaving(false);
        return;
      }

      const updateData = built.body;

      // Only admin can update verification status
      if (isAdmin) {
        updateData.verified = verified;
        if (verified && !initialDataPoint.verified) {
          updateData.verified_by = user?.id || null; // store user id
          updateData.verified_at = new Date().toISOString();
        }
      }

      // Re-sign the new payload so the backend can spend the previous PushDrop
      // and anchor a fresh one. Skipped if the user isn't the owner (admin
      // edits don't re-anchor — they just patch DB fields).
      const isOwner = user?.id === initialDataPoint.userId;
      if (isOwner && userWallet && userPubKey) {
        const payload = {
          cropName: cropType,
          brixValue: brixToSave,
          brandName: brand || null,
          notes: outlierNotes || null,
          assessmentDate: toISODateOrExisting(measurementDate, initialDataPoint.submittedAt),
          purchaseDate: purchaseDate || null,
          latitude: initialDataPoint.latitude,
          longitude: initialDataPoint.longitude,
          locationName: locationName || null,
        };
        try {
          const sig = await signSubmissionPayload(userWallet, userPubKey, payload);
          updateData.payloadJson = sig.payloadJson;
          updateData.userSignature = sig.userSignature;
          updateData.userKeyID = sig.userKeyID;
          updateData.userIdentityKey = sig.userIdentityKey;
        } catch (sigErr: any) {
          toast({
            title: 'Signing failed',
            description: sigErr?.message || 'Please approve the signature in your wallet and try again.',
            variant: 'destructive',
          });
          setSaving(false);
          return;
        }
      }

      await apiPut(`/api/submissions/${initialDataPoint.id}`, updateData);

      console.log('Update successful');

      toast({
        title: 'Success',
        description: 'Reading updated successfully',
      });

      // Build updated data point for UI
      const updatedDataPoint: BrixDataPoint = {
        ...initialDataPoint,
        brixLevel: brixToSave,
        cropType: cropType,
        variety: variety || '',
        locationName: locationName,
        placeName: placeName,
        latitude: latitude,
        longitude: longitude,
        submittedAt: toISODateOrExisting(measurementDate, initialDataPoint.submittedAt),
        purchaseDate: purchaseDate || null,
        outlier_notes: outlierNotes || '',
        brandName: brand,
        verified: isAdmin ? verified : initialDataPoint.verified,
        // Keep display name stable; don't overwrite with a UUID
        verifiedBy: initialDataPoint.verifiedBy,
        verifiedAt: (isAdmin && verified && !initialDataPoint.verified) ? new Date().toISOString() : initialDataPoint.verifiedAt,
      };

      onUpdateSuccess?.(updatedDataPoint);
      setIsEditing(false);
      console.log('=== SAVE OPERATION COMPLETE ===');
    } catch (error: any) {
      console.error('=== SAVE OPERATION ERROR ===');
      console.error('Error details:', error);
      toast({
        title: 'Error',
        description: `Failed to update submission: ${error?.message || 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!initialDataPoint) {
    return null;
  }

  // Show loading state if static data is still loading or modal is initializing
  const isLoading = staticDataLoading || isInitializing;

  if (isLoading) {
    if (isMobilePage) {
      if (!isOpen) return null;
      return (
        <div className="fixed inset-0 z-50 bg-surface-canvas flex flex-col items-center justify-center pt-[var(--safe-top)]">
          <Loader2 className="w-12 h-12 animate-spin text-green-mid" />
          <p className="mt-4 text-text-muted-brown">Loading data...</p>
        </div>
      );
    }
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md md:max-w-3xl rounded-2xl flex flex-col items-center justify-center h-64">
          <Loader2 className="w-12 h-12 animate-spin text-green-mid" />
          <p className="mt-4 text-text-muted-brown">Loading data...</p>
        </DialogContent>
      </Dialog>
    );
  }

  const isOwner = user?.id === initialDataPoint.userId;
  // Editing is owner-only (while still unverified). Admins do not edit other
  // people's readings; they verify/reject and can delete (see canDelete).
  const canEdit = isOwner && !initialDataPoint.verified;
  const canDelete = isAdmin || (isOwner && !initialDataPoint.verified);
  const isRejected = !!initialDataPoint.rejected;

  const cropThresholds = initialDataPoint.cropType
    ? (getThresholds(initialDataPoint.cropType) ?? {
        poor: initialDataPoint.poorBrix ?? 0,
        average: initialDataPoint.averageBrix ?? 0,
        good: initialDataPoint.goodBrix ?? 0,
        excellent: initialDataPoint.excellentBrix ?? 0,
      })
    : undefined;

  // Color and quality label both come from gradeBrix so they can never diverge.
  // hex resolves the same --score-* token the data-row badge uses (one source of
  // truth) — do NOT re-derive color from a parallel quality→color map here.
  const { quality: qualityText } = gradeBrix(initialDataPoint.brixLevel, cropThresholds);

  const detailContent = (
    <>
          {(error || staticDataError) && (
            <div className="flex items-center p-4 bg-destructive/10 text-destructive rounded-2xl">
              <AlertCircle className="w-5 h-5 mr-3" />
              <p>{error || staticDataError}</p>
            </div>
          )}

          <div className="space-y-6">
            <RefractometerReading
              thresholds={cropThresholds}
              value={initialDataPoint.brixLevel}
              cropName={getDisplayLabel(crops, initialDataPoint.cropType)}
              quality={qualityText}
              variant={isMobilePage ? 'mobile' : 'desktop'}
            />

            <div className="pt-4 border-t border-hairline">
              <h3 className="text-lg font-bold font-display mb-2 text-center text-text-dark">
                Reading Details
              </h3>

              <SubmissionEditFields
                state={editState}
                isEditing={isEditing}
                dataPoint={initialDataPoint}
                crops={crops}
                brands={brands}
                locations={locations}
                getDisplayLabel={getDisplayLabel}
              />

              <div className="mt-4 space-y-4">
              <DetailSection icon={<CheckCircle className="w-3.5 h-3.5 text-text-mid" />} title="Provenance" columns={2}>
                {isRejected && (
                  <DetailRow label="Rejected">
                    <span className="block break-words leading-relaxed text-text-mid">
                      {initialDataPoint.rejectionMessage || 'No reason given.'}
                    </span>
                  </DetailRow>
                )}
                <DetailRow label="Verified">
                  {isAdmin && isEditing ? (
                    <Input id="verified-checkbox" type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="w-4 h-4" />
                  ) : (
                    <VerifiedBadge verified={!!verified} />
                  )}
                  {verified && verifiedBy ? (
                    <span className="mt-1 flex items-center gap-1 text-xs font-normal text-text-mid">
                      <User className="w-3 h-3" /> by {formatUsername(verifiedBy)}
                    </span>
                  ) : null}
                </DetailRow>
                <DetailRow label="Blockchain" last>
                  <div className="flex items-center gap-2 flex-wrap">
                    <BlockchainBadge secured={!!initialDataPoint.outpoint} />
                    {initialDataPoint.outpoint && (() => {
                      const txid = initialDataPoint.outpoint.split('.')[0];
                      return (
                        <a
                          href={`https://whatsonchain.com/tx/${txid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-blue-mid hover:text-blue-deep font-mono text-xs min-w-0"
                          title={`View transaction on WhatsOnChain: ${txid}`}
                        >
                          <span className="truncate">{txid.slice(0, 10)}…{txid.slice(-8)}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      );
                    })()}
                  </div>
                </DetailRow>
              </DetailSection>
              </div>
            </div>

            <div className="mt-4">
              <DetailSection icon={<ImageIcon className="w-3.5 h-3.5 text-text-mid" />} title={`Reference Images (${imageUrls.length})`}>
                <div className="pt-1 pb-3">
                  {imagesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-green-mid" />
                      <span className="ml-3 text-sm text-text-muted">Loading images...</span>
                    </div>
                  ) : imageUrls.length === 0 ? (
                    <p className="text-sm text-text-muted italic">No images added for this reading.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {imageUrls.map((url: string, index: number) => (
                        <div key={index} className="relative w-full pb-[75%] rounded-2xl overflow-hidden shadow-sm border border-hairline group">
                          <img
                            src={url}
                            alt={`Submission image ${index + 1}`}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              e.currentTarget.src = 'https://placehold.co/400x300/CCCCCC/333333?text=Image+Error';
                              e.currentTarget.alt = 'Error loading image';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </DetailSection>
            </div>
          </div>
    </>
  );

  const detailFooter = (
    <div className="flex justify-between items-center pt-4 border-t border-hairline pb-[calc(1rem+var(--bottom-inset))]">
          {isEditing ? (
            <>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="h-auto py-3 px-6 text-sm font-medium rounded-xl text-white bg-action-primary hover:bg-action-primary-hover"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving} className="h-auto py-3 px-6 text-sm font-medium rounded-xl">
                Cancel
              </Button>
            </>
          ) : isAdmin ? (
            <div className="flex items-center gap-2 flex-wrap">
              {isRejected ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleRestoreSubmission}
                    disabled={rejecting || isDeleting}
                    className="h-auto py-3 px-6 text-sm font-medium rounded-xl border-hairline"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {rejecting ? 'Restoring...' : 'Restore'}
                  </Button>
                  <Button variant="outline" onClick={handleDelete} disabled={isDeleting || rejecting} className="h-auto py-3 px-6 text-sm font-medium rounded-xl border-hairline text-action-danger hover:bg-score-poor-bg">
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </Button>
                </>
              ) : !verified ? (
                <>
                  <Button
                    onClick={() => handleSetVerified(true)}
                    disabled={verifying || isDeleting || rejecting}
                    className="h-auto py-3 px-6 text-sm font-medium rounded-xl text-white bg-green-fresh hover:bg-green-mid"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {verifying ? 'Verifying...' : 'Verify'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setRejectDialogOpen(true)}
                    disabled={rejecting || verifying || isDeleting}
                    className="h-auto py-3 px-6 text-sm font-medium rounded-xl border-hairline text-score-average hover:bg-score-average-bg"
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    {rejecting ? 'Rejecting...' : 'Reject'}
                  </Button>
                  <Button variant="outline" onClick={handleDelete} disabled={isDeleting || verifying || rejecting} className="h-auto py-3 px-6 text-sm font-medium rounded-xl border-hairline text-action-danger hover:bg-score-poor-bg">
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleSetVerified(false)}
                    disabled={verifying || isDeleting}
                    className="h-auto py-3 px-6 text-sm font-medium rounded-xl"
                  >
                    {verifying ? 'Working...' : 'Unverify'}
                  </Button>
                  <Button variant="outline" onClick={handleDelete} disabled={isDeleting || verifying} className="h-auto py-3 px-6 text-sm font-medium rounded-xl border-hairline text-action-danger hover:bg-score-poor-bg">
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </Button>
                </>
              )}
            </div>
          ) : (
            canDelete && (
              <Button variant="outline" onClick={handleDelete} disabled={isDeleting} className="h-auto py-3 px-6 text-sm font-medium rounded-xl border-hairline text-action-danger hover:bg-score-poor-bg">
                <Trash2 className="w-4 h-4 mr-2" />
                {isDeleting ? 'Deleting...' : 'Delete Reading'}
              </Button>
            )
          )}
    </div>
  );

  // Shared by all three layouts below; collects the required reason.
  const rejectDialog = (
    <RejectSubmissionDialog
      open={rejectDialogOpen}
      onOpenChange={setRejectDialogOpen}
      busy={rejecting}
      onConfirm={(message) => {
        setRejectDialogOpen(false);
        void handleRejectSubmission(message);
      }}
    />
  );

  // ── Route page: the surrounding page owns the chrome ──
  if (presentation === 'page') {
    return (
      <div>
        {detailContent}
        {detailFooter}
        {rejectDialog}
      </div>
    );
  }

  // ── Mobile (≤640px): bottom sheet covering the page ──
  if (isMobilePage) {
    return (
      <>
        <Drawer open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
          <DrawerContent className="h-[96%] bg-surface-canvas">
            <DrawerTitle className="sr-only">Reading details</DrawerTitle>
            <div className="flex items-center gap-1 h-14 px-2 shrink-0 border-b border-hairline bg-card text-card-foreground">
              <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
                <ArrowLeft className="w-5 h-5" />
                <span className="sr-only">Back</span>
              </Button>
              <span className="flex-1 min-w-0 truncate text-base font-bold font-display text-text-dark">
                {`${isEditing ? 'Edit' : 'View'}: ${getDisplayLabel(crops, initialDataPoint.cropType)}${initialDataPoint.locationName ? ` · ${getDisplayLabel(locations, initialDataPoint.locationName)}` : ''}`}
              </span>
              {!isEditing && canEdit && (
                <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="shrink-0">
                  <Edit className="w-5 h-5" />
                  <span className="sr-only">Edit</span>
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-panel px-3 py-4">{detailContent}</div>
            <div className="shrink-0 px-3 bg-card">{detailFooter}</div>
          </DrawerContent>
        </Drawer>
        {rejectDialog}
      </>
    );
  }

  // ── Desktop (≥641px): unchanged modal ──
  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md md:max-w-3xl rounded-2xl">
          <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center justify-between text-2xl font-bold font-display">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="shrink-0 hover:bg-surface-canvas -ml-2"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="sr-only">Back</span>
              </Button>
              <span>{`${isEditing ? 'Edit' : 'View'}: ${getDisplayLabel(crops, initialDataPoint.cropType)}${initialDataPoint.locationName ? ` · ${getDisplayLabel(locations, initialDataPoint.locationName)}` : ''}`}</span>
            </div>
            {!isEditing && canEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(true)}
                className="hover:bg-surface-canvas"
              >
                <Edit className="w-5 h-5" />
                <span className="sr-only">Edit</span>
              </Button>
            )}
          </DialogTitle>
            <DialogDescription className="sr-only">
              View and edit a BRIX reading.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[80vh] overflow-y-auto scrollbar-panel px-1">{detailContent}</div>
          {detailFooter}
        </DialogContent>
      </Dialog>
      {rejectDialog}
    </>
  );
};

export default DataPointDetailModal;