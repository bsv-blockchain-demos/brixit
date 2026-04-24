import React, { useState, useEffect } from 'react';
import { BrixDataPoint } from '../../types';
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
  Calendar,
  User,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
  Loader2,
  X,
  Edit,
  Droplets,
  Tag,
  Package,
  MapIcon,
  FileText,
  Building,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { deleteSubmission } from '../../lib/fetchSubmissions';
import { useToast } from '../ui/use-toast';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { apiPut, API_BASE } from '../../lib/api';
import { formatUsername } from '../../lib/formatUsername';
import { scoreBrix } from '../../lib/getBrixColor';
import { useCropThresholds } from '../../contexts/CropThresholdContext';
import Combobox from '../ui/combo-box';
import LocationSearch from './LocationSearch';
import { useStaticData } from '../../hooks/useStaticData';

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
  const { toast } = useToast();
  const { getThresholds } = useCropThresholds();

  // Use the shared static data hook and destructure the new 'locations' property
  const { crops, brands, locations, isLoading: staticDataLoading, error: staticDataError } = useStaticData();

  // Resolve display label from static data, falling back to title-cased name
  const getDisplayLabel = (items: { name: string; label?: string }[], name: string | undefined) => {
    if (!name) return 'N/A';
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');
    const match = items.find(i => normalize(i.name) === normalize(name));
    if (match?.label) return match.label;
    if (match) return match.name;
    return name.replace(/\b\w/g, c => c.toUpperCase());
  };

  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

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
        setImageUrls([]);
        setImagesLoading(false);
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

  useEffect(() => {
    // Separate image fetching into its own effect to prevent state reset race conditions
    const fetchImages = async () => {
      if (!isOpen || !initialDataPoint) return;
      setImagesLoading(true);

      const urls = Array.isArray(initialDataPoint.images)
        ? initialDataPoint.images
            .filter((imagePath): imagePath is string => typeof imagePath === 'string' && imagePath.length > 0)
            .map((imagePath) => `${API_BASE}${imagePath}`)
        : [];

      setImageUrls(urls);
      setImagesLoading(false);
    };

    fetchImages();
  }, [isOpen, initialDataPoint]);

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
      if (locationIdToSet !== undefined) updateData.location_id = locationIdToSet;

      // Only admin can update verification status
      if (isAdmin) {
        updateData.verified = verified;
        if (verified && !initialDataPoint.verified) {
          updateData.verified_by = user?.id || null; // store user id
          updateData.verified_at = new Date().toISOString();
        }
      }

      console.log('Final update data:', updateData);
      console.log('Updating submission with ID:', initialDataPoint.id);

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

  const handlePlaceSelect = (place: { name: string, latitude: number, longitude: number, locationName: string }) => {
    setPlaceName(place.name);
    setLocationName(place.locationName);
    setLatitude(place.latitude);
    setLongitude(place.longitude);
  };

  if (!initialDataPoint) {
    console.log('initialDataPoint is null, returning early.');
    return null;
  }

  // Show loading state if static data is still loading or modal is initializing
  const isLoading = staticDataLoading || isInitializing;

  if (isLoading) {
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
  const canEdit = isAdmin || (isOwner && !initialDataPoint.verified);
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
              className="shrink-0 hover:bg-blue-mist -ml-2"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="sr-only">Back</span>
            </Button>
            <span>{isEditing ? 'Edit Submission' : `Details for ${getDisplayLabel(crops, initialDataPoint.cropType)}`}</span>
          </div>
          {!isEditing && canEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(true)}
              className="hover:bg-blue-mist"
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

        <div className="max-h-[80vh] overflow-y-auto px-1">
          {(error || staticDataError) && (
            <div className="flex items-center p-4 bg-destructive/10 text-destructive rounded-2xl">
              <AlertCircle className="w-5 h-5 mr-3" />
              <p>{error || staticDataError}</p>
            </div>
          )}

          <div className="space-y-6">
            <div
              className="rounded-2xl border shadow-sm p-6"
              style={{ borderColor: 'var(--blue-pale)', backgroundColor: 'hsl(var(--card))' }}
            >
              <p className="uppercase tracking-[0.2em] text-xs font-medium mb-4" style={{ color: 'var(--text-muted)' }}>
                Refractometer Reading
              </p>
              <div className="flex items-center space-x-4">
                <div
                  className="w-[4.5rem] h-[4.5rem] rounded-2xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: scoreStyle.color }}
                  aria-label={`Brix score ${initialDataPoint.brixLevel}, rated ${qualityText}`}
                >
                  <span className="text-white font-display font-bold text-3xl">{initialDataPoint.brixLevel}</span>
                </div>
                <div>
                  <p className="font-display font-bold text-3xl" style={{ color: scoreStyle.color }}>
                    {initialDataPoint.brixLevel} <span className="font-body text-lg font-medium" style={{ color: 'var(--text-mid)' }}>BRIX</span>
                  </p>
                  <span
                    className="inline-block mt-1 px-3 py-0.5 rounded-full text-sm font-medium"
                    style={{ color: scoreStyle.color, backgroundColor: `color-mix(in srgb, ${scoreStyle.color} 15%, transparent)` }}
                  >
                    {qualityText} Quality
                  </span>
                  {cropThresholds?.poor != null && cropThresholds?.excellent != null && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      Crop range: {cropThresholds.poor}–{cropThresholds.excellent} BRIX
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-blue-pale">
              <h3 className="text-lg font-bold font-display text-text-dark mb-4">Submission Details</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col space-y-2 rounded-2xl border shadow-sm p-4" style={{ borderColor: 'var(--blue-pale)', backgroundColor: 'hsl(var(--card))' }}>
                  <Label className="text-sm text-text-dark flex items-center space-x-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--blue-deep)' }}>
                      <Droplets className="w-3.5 h-3.5 text-white" />
                    </span>
                    <span>BRIX Level</span>
                  </Label>
                  {isEditing ? (
                    <Input type="number" value={brixLevel} onChange={e => setBrixLevel(e.target.value === '' ? '' : Number(e.target.value))} min={0} step={0.1} />
                  ) : (
                    <p className="font-medium">{initialDataPoint.brixLevel}</p>
                  )}
                </div>
                <div className="flex flex-col space-y-2 rounded-2xl border shadow-sm p-4" style={{ borderColor: 'var(--blue-pale)', backgroundColor: 'hsl(var(--card))' }}>
                  <Label className="text-sm text-text-dark flex items-center space-x-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--blue-deep)' }}>
                      <Package className="w-3.5 h-3.5 text-white" />
                    </span>
                    <span>Crop Type</span>
                  </Label>
                  {isEditing ? (
                    <div>
                      <Combobox
                        items={Array.isArray(crops) ? crops : []}
                        value={cropType}
                        onSelect={setCropType}
                        placeholder="Select Crop"
                      />
                    </div>
                  ) : (
                    <p className="font-medium">{getDisplayLabel(crops, initialDataPoint.cropType)}</p>
                  )}
                </div>
                <div className="flex flex-col space-y-2 rounded-2xl border shadow-sm p-4" style={{ borderColor: 'var(--blue-pale)', backgroundColor: 'hsl(var(--card))' }}>
                  <Label className="text-sm text-text-dark flex items-center space-x-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--blue-deep)' }}>
                      <Tag className="w-3.5 h-3.5 text-white" />
                    </span>
                    <span>Brand</span>
                  </Label>
                  {isEditing ? (
                    <div>
                      <Combobox
                        items={Array.isArray(brands) ? brands : []}
                        value={brand}
                        onSelect={setBrand}
                        placeholder="Select Brand"
                      />
                    </div>
                  ) : (
                    <p className="font-medium">{getDisplayLabel(brands, initialDataPoint.brandName)}</p>
                  )}
                </div>
                <div className="flex flex-col space-y-2 rounded-2xl border shadow-sm p-4" style={{ borderColor: 'var(--blue-pale)', backgroundColor: 'hsl(var(--card))' }}>
                  <Label className="text-sm text-text-dark flex items-center space-x-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--blue-deep)' }}>
                      <Building className="w-3.5 h-3.5 text-white" />
                    </span>
                    <span>Location (Store)</span>
                  </Label>
                  {isEditing ? (
                    <div>
                      <Combobox
                        items={Array.isArray(locations) ? locations : []}
                        value={locationName}
                        onSelect={setLocationName}
                        placeholder="Select Store"
                      />
                    </div>
                  ) : (
                    <p className="font-medium">{getDisplayLabel(locations, initialDataPoint.locationName)}</p>
                  )}
                </div>
                <div className="flex flex-col space-y-2 rounded-2xl border shadow-sm p-4" style={{ borderColor: 'var(--blue-pale)', backgroundColor: 'hsl(var(--card))' }}>
                  <Label className="text-sm text-text-dark flex items-center space-x-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--blue-deep)' }}>
                      <MapIcon className="w-3.5 h-3.5 text-white" />
                    </span>
                    <span>Place (Address)</span>
                  </Label>
                  {isEditing ? (
                    <LocationSearch
                      value={placeName}
                      onLocationSelect={handlePlaceSelect}
                      onChange={(e) => setPlaceName(e.target.value)}
                      isLoading={isLocationLoading}
                    />
                  ) : (
                    <>
                      <p className="font-medium">{initialDataPoint.streetAddress || 'N/A'}</p>
                      <p className="text-xs text-text-muted-brown">
                        {initialDataPoint.latitude?.toFixed(4)}, {initialDataPoint.longitude?.toFixed(4)}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex flex-col space-y-2 rounded-2xl border shadow-sm p-4" style={{ borderColor: 'var(--blue-pale)', backgroundColor: 'hsl(var(--card))' }}>
                  <Label className="text-sm text-text-dark flex items-center space-x-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--blue-deep)' }}>
                      <Calendar className="w-3.5 h-3.5 text-white" />
                    </span>
                    <span>Assessment Date</span>
                  </Label>
                  {isEditing ? (
                    <Input type="date" value={measurementDate} onChange={e => setMeasurementDate(e.target.value)} />
                  ) : (
                    <p className="font-medium">{new Date(initialDataPoint.submittedAt).toLocaleDateString()}</p>
                  )}
                </div>
                <div className="flex flex-col space-y-2 rounded-2xl border shadow-sm p-4" style={{ borderColor: 'var(--blue-pale)', backgroundColor: 'hsl(var(--card))' }}>
                  <Label className="text-sm text-text-dark flex items-center space-x-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--blue-deep)' }}>
                      <Calendar className="w-3.5 h-3.5 text-white" />
                    </span>
                    <span>Purchase Date</span>
                  </Label>
                  {isEditing ? (
                    <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                  ) : (
                    <p className="font-medium">{initialDataPoint.purchaseDate ? new Date(initialDataPoint.purchaseDate).toLocaleDateString() : 'N/A'}</p>
                  )}
                </div>
                <div className="flex flex-col space-y-2 rounded-2xl border shadow-sm p-4" style={{ borderColor: 'var(--blue-pale)', backgroundColor: 'hsl(var(--card))' }}>
                  <Label className="text-sm text-text-dark flex items-center space-x-2">
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--blue-deep)' }}>
                      <Tag className="w-3.5 h-3.5 text-white" />
                    </span>
                    <span>Variety</span>
                  </Label>
                  {isEditing ? (
                    <Input type="text" value={variety} onChange={e => setVariety(e.target.value)} />
                  ) : (
                    <p className="font-medium">{initialDataPoint.variety || initialDataPoint.posType || 'N/A'}</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border shadow-sm p-4 mt-4" style={{ borderColor: 'var(--blue-pale)', backgroundColor: 'hsl(var(--card))' }}>
                <Label className="text-sm text-text-dark mb-2 flex items-center space-x-2">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--blue-deep)' }}>
                    <FileText className="w-3.5 h-3.5 text-white" />
                  </span>
                  <span>Outlier Notes</span>
                </Label>
                {isEditing ? (
                  <Textarea value={outlierNotes} onChange={e => setOutlierNotes(e.target.value)} rows={4} />
                ) : (
                  <p className="font-medium">{initialDataPoint.outlier_notes || 'No notes for this submission.'}</p>
                )}
              </div>

              <div className="rounded-2xl border shadow-sm p-4 mt-4 flex items-center justify-between" style={{ borderColor: 'var(--blue-pale)', backgroundColor: 'hsl(var(--card))' }}>
                <div className="flex items-center space-x-2">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--blue-deep)' }}>
                    <CheckCircle className="w-3.5 h-3.5 text-white" />
                  </span>
                  <Label htmlFor="verified-checkbox" className="text-sm font-semibold text-text-mid">
                    Verified
                  </Label>
                </div>
                {isAdmin && isEditing ? (
                  <Input
                    id="verified-checkbox"
                    type="checkbox"
                    checked={verified}
                    onChange={(e) => setVerified(e.target.checked)}
                    className="w-4 h-4"
                  />
                ) : (
                  <span className="text-sm font-medium" style={{ color: 'var(--text-dark)' }}>
                    {verified ? 'Yes' : 'No'}
                  </span>
                )}
              </div>

              {verified && (
                <div className="mt-2 text-sm text-text-muted-brown flex items-center justify-end">
                  <User className="w-4 h-4 mr-1" />
                  <span>Verified by: {verifiedBy ? formatUsername(verifiedBy) : 'N/A'}</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-blue-pale">
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
                    <div key={index} className="relative w-full pb-[75%] rounded-2xl overflow-hidden shadow-sm border group" style={{ borderColor: 'var(--blue-pale)' }}>
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
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-blue-pale pb-[env(safe-area-inset-bottom,1rem)]">
          {isEditing ? (
            <>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="h-auto py-3 px-6 text-sm font-medium rounded-xl text-white"
                style={{ backgroundColor: 'var(--green-fresh)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--green-mid)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--green-fresh)')}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving} className="h-auto py-3 px-6 text-sm font-medium rounded-xl">
                Cancel
              </Button>
            </>
          ) : (
            canDelete && (
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="h-auto py-3 px-6 text-sm font-medium rounded-xl">
                {isDeleting ? 'Deleting...' : 'Delete Submission'}
              </Button>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DataPointDetailModal;