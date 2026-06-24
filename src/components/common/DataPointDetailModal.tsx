import React, { useState, useEffect } from 'react';
import { BrixDataPoint } from '../../types';
import { VerifiedBadge, BlockchainBadge } from './StatusBadges';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import {
  ArrowLeft,
  User,
  CheckCircle,
  AlertCircle,
  Ban,
  Trash2,
  Image as ImageIcon,
  Loader2,
  X,
  Clock,
  Edit,
  Package,
  FileText,
  Building,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWallet } from '../../contexts/WalletContext';
import { signSubmissionPayload } from '../../lib/signSubmissionPayload';
import { deleteSubmission } from '../../lib/fetchSubmissions';
import { verifySubmission, rejectSubmission } from '../../lib/adminApi';
import { useToast } from '../ui/use-toast';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { apiPut } from '../../lib/api';
import { useImageUrls } from '../../hooks/useImageUrls';
import { formatUsername } from '../../lib/formatUsername';
import { formatHumanDate } from '../../lib/formatDate';
import { scoreBrix } from '../../lib/getBrixColor';
import { useCropThresholds } from '../../contexts/CropThresholdContext';
import Combobox from '../ui/combo-box';
import { useStaticData } from '../../hooks/useStaticData';

// Grouped detail card: one icon-headed section holding a list of label/value rows.
// All colors go through inverting tokens (card, hairline, blue-deep, text-*) so the
// whole thing flips correctly in dark mode.
function DetailSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl border shadow-sm overflow-hidden"
      style={{ borderColor: 'var(--hairline)', backgroundColor: 'hsl(var(--card))' }}
    >
      <div className="flex items-center gap-2 px-4 pt-4 pb-1">
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--blue-deep)' }}
        >
          {icon}
        </span>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-mid">{title}</h4>
      </div>
      <div className="px-4 pb-1">{children}</div>
    </section>
  );
}

// One row: muted label on top, prominent value below. `children` is either a plain
// value (view mode) or an input/combobox (edit mode).
function DetailRow({ label, children, last = false, valueClassName = '' }: { label: string; children: React.ReactNode; last?: boolean; valueClassName?: string }) {
  return (
    <div className={last ? 'py-3' : 'py-3 border-b border-hairline'}>
      <p className="text-xs font-medium text-text-mid">{label}</p>
      <div className={`mt-1 text-sm font-medium text-text-dark ${valueClassName}`}>{children}</div>
    </div>
  );
}

// Mobile detail breakpoint: ≤640px renders a full-screen page (no modal/overlay);
// ≥641px keeps the desktop modal exactly as before.
function useMaxWidth(px: number): boolean {
  const query = `(max-width: ${px}px)`;
  const [matches, setMatches] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    onChange();
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

interface DataPointDetailModalProps {
  dataPoint: BrixDataPoint | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleteSuccess?: (id: string) => void;
  onUpdateSuccess?: (dataPoint: BrixDataPoint) => void;
  initialEditMode?: boolean;
}

const DataPointDetailModal: React.FC<DataPointDetailModalProps> = ({
  dataPoint: initialDataPoint,
  isOpen,
  onClose,
  onDeleteSuccess,
  onUpdateSuccess,
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

  // Resolve display label from static data, falling back to title-cased name
  const getDisplayLabel = (items: { name: string; label?: string }[], name: string | undefined) => {
    if (!name) return 'N/A';
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');
    const match = items.find(i => normalize(i.name) === normalize(name));
    const raw = match?.label || match?.name || name;
    // Labels are stored lowercase — always render with a capital first letter.
    return raw.replace(/\b\w/g, c => c.toUpperCase());
  };

  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [rejecting, setRejecting] = useState(false);
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
  const [brixLevel, setBrixLevel] = useState<number | ''>('');
  const [cropType, setCropType] = useState('');
  const [variety, setVariety] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [measurementDate, setMeasurementDate] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [outlierNotes, setOutlierNotes] = useState('');
  const [brand, setBrand] = useState('');
  const [verified, setVerified] = useState(false);
  const [verifiedBy, setVerifiedBy] = useState('');
  const [verifiedAt, setVerifiedAt] = useState('');

  useEffect(() => {
    async function initializeModalData() {
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
          description: 'Submission deleted successfully',
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
        description: 'Failed to delete submission',
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
        toast({ title: next ? 'Submission verified' : 'Submission rejected' });
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
  const handleRejectSubmission = async () => {
    if (!initialDataPoint) return;
    setRejecting(true);
    try {
      const res = await rejectSubmission(initialDataPoint.id, true);
      if (res?.success) {
        toast({ title: 'Submission rejected' });
        onUpdateSuccess?.({ ...initialDataPoint, verified: false });
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
    const normalizeBrix = (val: number | ''): number | null => {
      if (val === '') return null;
      const n = typeof val === 'number' ? val : Number(val);
      return Number.isFinite(n) ? n : null;
    };
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

    // Validate date strings
    const toISODateOrExisting = (dateStr: string, existingISO: string) => {
      if (!dateStr) return existingISO;
      const d = new Date(`${dateStr}T00:00:00.000Z`);
      return isNaN(d.getTime()) ? existingISO : d.toISOString();
    };

    setSaving(true);
    try {
      console.log('Looking for matching items in static data...');

      const safecrops = Array.isArray(crops) ? crops : [];
      const safebrands = Array.isArray(brands) ? brands : [];
      const safelocations = Array.isArray(locations) ? locations : []; // Updated variable name

      // Resolve IDs only when values changed; crop is required if changed
      let cropIdToSet: string | undefined;
      let brandIdToSet: string | null | undefined;
      let locationIdToSet: string | null | undefined;
      let placeIdToSet: string | null | undefined;

      if (cropType !== initialDataPoint.cropType) {
        const cropItem = safecrops.find(c => c?.name === cropType);
        if (!cropItem?.id) {
          toast({
            title: 'Invalid crop',
            description: 'Please select a valid crop from the list.',
            variant: 'destructive',
          });
          setSaving(false);
          return;
        }
        cropIdToSet = cropItem.id;
      }

      if (brand !== initialDataPoint.brandName) {
        if (!brand) {
          brandIdToSet = null; // allow clearing brand
        } else {
          const brandItem = safebrands.find(b => b?.name === brand);
          if (!brandItem?.id) {
            toast({
              title: 'Invalid brand',
              description: 'Please select a valid brand from the list or clear the field.',
              variant: 'destructive',
            });
            setSaving(false);
            return;
          }
          brandIdToSet = brandItem.id;
        }
      }

      if (locationName !== initialDataPoint.locationName) {
        if (!locationName) {
          locationIdToSet = null;
        } else {
          const locationItem = safelocations.find(s => s?.name === locationName);
          if (!locationItem?.id) {
            toast({
              title: 'Invalid location',
              description: 'Please select a valid location from the list or clear the field.',
              variant: 'destructive',
            });
            setSaving(false);
            return;
          }
          locationIdToSet = locationItem.id;
        }
      }

      // Build update payload (only include fields that can change)
      const updateData: Record<string, any> = {
        brix_value: brixToSave,
        crop_variety: variety || null,
        assessment_date: toISODateOrExisting(measurementDate, initialDataPoint.submittedAt),
        purchase_date: purchaseDate || null,
        outlier_notes: outlierNotes || null,
      };

      if (typeof cropIdToSet === 'string') updateData.crop_id = cropIdToSet;
      if (brandIdToSet !== undefined) updateData.brand_id = brandIdToSet;
      // Backend stores locations in the venues table — wire `location_id`
      // selections to the PUT body's `venue_id`.
      if (locationIdToSet !== undefined) updateData.venue_id = locationIdToSet;

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
        description: 'Submission updated successfully',
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

  const cropThresholds = initialDataPoint.cropType
    ? (getThresholds(initialDataPoint.cropType) ?? {
        poor: initialDataPoint.poorBrix ?? 0,
        average: initialDataPoint.averageBrix ?? 0,
        good: initialDataPoint.goodBrix ?? 0,
        excellent: initialDataPoint.excellentBrix ?? 0,
      })
    : undefined;

  const { quality: qualityText } = scoreBrix(initialDataPoint.brixLevel, cropThresholds);

  const scoreStyle = (() => {
    switch (qualityText) {
      case 'Excellent': return { color: 'var(--green-mid)' };
      case 'Good':
      case 'Average':   return { color: 'var(--gold)' };
      case 'Poor':      return { color: 'var(--score-poor)' };
      default:          return { color: 'var(--text-muted)' };
    }
  })();

  const detailContent = (
    <>
          {(error || staticDataError) && (
            <div className="flex items-center p-4 bg-destructive/10 text-destructive rounded-2xl">
              <AlertCircle className="w-5 h-5 mr-3" />
              <p>{error || staticDataError}</p>
            </div>
          )}

          <div className="space-y-6">
            <div
              className="rounded-2xl border shadow-sm p-6"
              style={{ borderColor: 'var(--hairline)', backgroundColor: 'hsl(var(--card))' }}
            >
              <p className="uppercase tracking-[0.2em] text-xs font-medium mb-4" style={{ color: 'var(--text-muted)' }}>
                Refractometer Reading
              </p>
              <div className="flex items-center gap-5">
                <div
                  className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center shrink-0 leading-none"
                  style={{ backgroundColor: scoreStyle.color }}
                  aria-label={`Brix score ${initialDataPoint.brixLevel}, rated ${qualityText}`}
                >
                  <span className="text-white font-display font-bold text-[2rem]">{initialDataPoint.brixLevel}</span>
                  <span className="text-white/80 text-[0.65rem] font-semibold uppercase tracking-widest mt-1.5">BRIX</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <span
                    className="inline-block px-3 py-1 rounded-full text-sm font-semibold"
                    style={{ color: scoreStyle.color, backgroundColor: `color-mix(in srgb, ${scoreStyle.color} 15%, transparent)` }}
                  >
                    {qualityText} Quality
                  </span>
                  {cropThresholds?.poor != null && cropThresholds?.excellent != null && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Crop range: {cropThresholds.poor}–{cropThresholds.excellent} BRIX
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-hairline">
              <h3 className="text-lg font-bold font-display text-text-dark mb-2">Submission Details</h3>

              <div className="space-y-4">
              <DetailSection icon={<Building className="w-3.5 h-3.5 text-white" />} title="Source">
                <DetailRow label="Location (Store)">
                  {isEditing ? (
                    <Combobox items={Array.isArray(locations) ? locations : []} value={locationName} onSelect={setLocationName} placeholder="Select Store" />
                  ) : (
                    getDisplayLabel(locations, initialDataPoint.locationName)
                  )}
                </DetailRow>
                <DetailRow label="Place (Address)">
                  {/* Address is read-only — it lives on the venue, not the submission. */}
                  <span className="block break-words leading-relaxed">{initialDataPoint.streetAddress || 'N/A'}</span>
                  {(initialDataPoint.latitude || initialDataPoint.longitude) ? (
                    <span className="block mt-1 text-xs font-normal text-text-mid">
                      {initialDataPoint.latitude?.toFixed(4)}, {initialDataPoint.longitude?.toFixed(4)}
                    </span>
                  ) : null}
                </DetailRow>
                <DetailRow label="Purchase Date">
                  {isEditing ? (
                    <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                  ) : (
                    formatHumanDate(initialDataPoint.purchaseDate)
                  )}
                </DetailRow>
                <DetailRow label="Assessment Date" last>
                  {isEditing ? (
                    <Input type="date" value={measurementDate} onChange={e => setMeasurementDate(e.target.value)} />
                  ) : (
                    formatHumanDate(initialDataPoint.submittedAt)
                  )}
                </DetailRow>
              </DetailSection>

              <DetailSection icon={<Package className="w-3.5 h-3.5 text-white" />} title="Product">
                <DetailRow label="Crop Type">
                  {isEditing ? (
                    <Combobox items={Array.isArray(crops) ? crops : []} value={cropType} onSelect={setCropType} placeholder="Select Crop" />
                  ) : (
                    getDisplayLabel(crops, initialDataPoint.cropType)
                  )}
                </DetailRow>
                <DetailRow label="Variety">
                  {isEditing ? (
                    <Input type="text" value={variety} onChange={e => setVariety(e.target.value)} />
                  ) : (
                    initialDataPoint.variety || initialDataPoint.posType || 'N/A'
                  )}
                </DetailRow>
                <DetailRow label="Brand">
                  {isEditing ? (
                    <Combobox items={Array.isArray(brands) ? brands : []} value={brand} onSelect={setBrand} placeholder="Select Brand" />
                  ) : (
                    getDisplayLabel(brands, initialDataPoint.brandName)
                  )}
                </DetailRow>
                <DetailRow label="BRIX Level" last>
                  {isEditing ? (
                    <Input type="number" value={brixLevel} onChange={e => setBrixLevel(e.target.value === '' ? '' : Number(e.target.value))} min={0} step={0.1} />
                  ) : (
                    initialDataPoint.brixLevel
                  )}
                </DetailRow>
              </DetailSection>
              </div>

              <div className="mt-4 space-y-4">
              <DetailSection icon={<FileText className="w-3.5 h-3.5 text-white" />} title="Notes">
                <DetailRow label="Outlier Notes" last>
                  {isEditing ? (
                    <Textarea value={outlierNotes} onChange={e => setOutlierNotes(e.target.value)} rows={4} />
                  ) : (
                    <span className="font-normal">{initialDataPoint.outlier_notes || 'No notes for this submission.'}</span>
                  )}
                </DetailRow>
              </DetailSection>

              <DetailSection icon={<CheckCircle className="w-3.5 h-3.5 text-white" />} title="Provenance">
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

            <div className="pt-4 border-t border-hairline">
              <h3 className="flex items-center space-x-2 text-lg font-bold font-display text-text-dark mb-4">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--blue-deep)' }}>
                  <ImageIcon className="w-3.5 h-3.5 text-white" />
                </span>
                <span>Reference Images ({imageUrls.length})</span>
              </h3>
              {imagesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-green-mid" />
                  <span className="ml-3 text-text-muted-brown">Loading images...</span>
                </div>
              ) : imageUrls.length === 0 ? (
                <p className="text-text-muted-brown italic">No images added for this submission.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {imageUrls.map((url: string, index: number) => (
                    <div key={index} className="relative w-full pb-[75%] rounded-2xl overflow-hidden shadow-sm border group" style={{ borderColor: 'var(--hairline)' }}>
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
          </div>
    </>
  );

  const detailFooter = (
    <div className="flex justify-between items-center pt-4 border-t border-hairline pb-[calc(1rem+var(--safe-bottom))]">
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
              {!verified ? (
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
                    onClick={handleRejectSubmission}
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
                {isDeleting ? 'Deleting...' : 'Delete Submission'}
              </Button>
            )
          )}
    </div>
  );

  // ── Mobile (≤640px): full-screen page, not a modal/overlay ──
  if (isMobilePage) {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-50 bg-surface-canvas flex flex-col pt-[var(--safe-top)]">
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
        <div className="flex-1 overflow-y-auto px-3 py-4">{detailContent}</div>
        <div className="shrink-0 px-3 bg-card">{detailFooter}</div>
      </div>
    );
  }

  // ── Desktop (≥641px): unchanged modal ──
  return (
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
            View and edit a BRIX measurement submission.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[80vh] overflow-y-auto px-1">{detailContent}</div>
        {detailFooter}
      </DialogContent>
    </Dialog>
  );
};

export default DataPointDetailModal;