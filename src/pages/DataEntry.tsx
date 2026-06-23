import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Layout/Header';
import { PageBackground } from '../components/ui/PageBackground';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  MapPin,
  Upload,
  Loader2,
  X,
  Calendar,
  Clock,
  Plus,
  Check,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../hooks/use-toast';
import { apiPost } from '@/lib/api';
import { useWallet } from '@/contexts/WalletContext';
import { signSubmissionPayload } from '@/lib/signSubmissionPayload';
import { buildSubmissionPayload } from '@/lib/buildSubmissionPayload';
import { getPresignedUploadUrl, uploadFileToS3, finalizeUpload } from '@/lib/uploadApi';
import LocationSearch from '../components/common/LocationSearch';
import VenuePrompt, { type VenueChoice } from '../components/common/VenuePrompt';
import { useStaticData } from '../hooks/useStaticData';
import ReadingCard, { type CropReading } from '../components/data-entry/ReadingCard';
import { FormSectionHeader } from '../components/common/FormSectionHeader';

interface DetailedLocationInfo {
  name: string;
  latitude: number;
  longitude: number;
  street_address?: string;
  city?: string;
  state?: string;
  country?: string;
  poi_name?: string;
  normalized_address?: string;
  business_name?: string;
}

const POS_OPTIONS = [
  { value: 'Supermarket', label: 'Supermarket' },
  { value: 'Farmers Market', label: 'Farmers Market' },
  { value: 'Farm Direct', label: 'Farm Direct' },
  { value: 'Online', label: 'Online' },
  { value: 'Other', label: 'Other' },
];

const mkReading = (): CropReading => ({
  id: crypto.randomUUID(),
  cropType: '',
  brixLevel: 12,
  brandName: '',
  notes: '',
  images: [],
});

// DataEntry

const DataEntry = () => {
  const { user } = useAuth();
  const { userWallet, userPubKey } = useWallet();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();

  const fadeUp = prefersReducedMotion
    ? {}
    : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };
  const stagger = prefersReducedMotion
    ? {}
    : { initial: 'hidden' as const, animate: 'visible' as const, variants: { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } } };
  const staggerChild = prefersReducedMotion
    ? {}
    : { variants: { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } } };

  const { crops, brands, isLoading: staticDataLoading, error: staticDataError } = useStaticData();

  // Stable first reading so both state values share the same id
  const firstReading = useRef(mkReading());
  const [readings, setReadings] = useState<CropReading[]>([firstReading.current]);
  const [openReadingId, setOpenReadingId] = useState<string | null>(firstReading.current.id);

  const [session, setSession] = useState({
    location: '',
    latitude: 0,
    longitude: 0,
    street_address: '',
    city: '',
    state: '',
    country: '',
    poi_name: '',
    business_name: '',
    normalized_address: '',
    posType: '',
    purchaseDate: '',
    measurementDate: new Date().toISOString().split('T')[0],
    venueChoice: null as VenueChoice | null,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingBrands, setPendingBrands] = useState<string[]>([]);

  // Mobile-only 2-step presentation (Shop → Crops). Desktop ignores this and
  // renders the full single-page form. All fields stay mounted regardless.
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (!user || (user.role !== 'contributor' && user.role !== 'admin')) {
      navigate('/leaderboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (staticDataError) {
      toast({ title: 'Error loading form options', description: staticDataError, variant: 'destructive' });
    }
  }, [staticDataError, toast]);

  const setSessionField = (field: string, value: any) => {
    setSession(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleReadingChange = (id: string, field: keyof CropReading, value: any) => {
    setReadings(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    const key = `reading_${id}_${field}`;
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const addReading = () => {
    const r = mkReading();
    setReadings(prev => [...prev, r]);
    setOpenReadingId(r.id);
  };

  const removeReading = (id: string) => {
    if (readings.length <= 1) return;
    const remaining = readings.filter(r => r.id !== id);
    setReadings(remaining);
    if (openReadingId === id) setOpenReadingId(remaining.at(-1)?.id ?? null);
  };

  const handleLocationSelect = (loc: DetailedLocationInfo) => {
    setSession(prev => ({
      ...prev,
      location: loc.name,
      latitude: loc.latitude,
      longitude: loc.longitude,
      street_address: loc.street_address || '',
      city: loc.city || '',
      state: loc.state || '',
      country: loc.country || '',
      poi_name: loc.poi_name || '',
      business_name: loc.business_name || '',
      normalized_address: loc.normalized_address || '',
      venueChoice: null,
    }));
    if (errors.location) setErrors(prev => ({ ...prev, location: '' }));
  };

  const handleAddBrand = (readingId: string, name: string) => {
    if (!pendingBrands.includes(name)) setPendingBrands(prev => [...prev, name]);
    handleReadingChange(readingId, 'brandName', name);
  };

  const handleReadingImageUpload = (readingId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const reading = readings.find(r => r.id === readingId);
    if (!reading) return;
    const files = Array.from(e.target.files || []);
    const valid: File[] = [];
    for (const f of files) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        setErrors(prev => ({ ...prev, [`reading_${readingId}_images`]: 'Only JPEG, PNG, and WebP images are allowed' }));
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, [`reading_${readingId}_images`]: 'File size must be less than 5MB' }));
        return;
      }
      valid.push(f);
    }
    if (valid.length + reading.images.length > 3) {
      setErrors(prev => ({ ...prev, [`reading_${readingId}_images`]: 'Maximum 3 images allowed' }));
      return;
    }
    handleReadingChange(readingId, 'images', [...reading.images, ...valid]);
    if (e.target) e.target.value = '';
  };

  const handleReadingImageRemove = (readingId: string, index: number) => {
    setReadings(prev => prev.map(r =>
      r.id === readingId ? { ...r, images: r.images.filter((_, i) => i !== index) } : r
    ));
  };

  const validateForm = (): boolean => {
    const e: Record<string, string> = {};
    if (!session.location.trim()) e.location = 'Please enter a location';

    const needsVenuePrompt = session.latitude !== 0 && !session.business_name && !session.poi_name;
    if (needsVenuePrompt && !session.venueChoice) {
      e.venueChoice = 'Please select or register a place, or choose Skip';
    }
    if (needsVenuePrompt && session.venueChoice?.kind === 'register') {
      const rc = session.venueChoice as any;
      if (!rc.name?.trim()) e.venueChoice = 'Please enter a place name';
    }

    // When no venue prompt, or venue choice isn't an existing venue with posType, require posType selection
    const lockedPosType =
      session.venueChoice?.kind === 'existing' && (session.venueChoice as any).posType
        ? (session.venueChoice as any).posType as string
        : null;
    if (!lockedPosType && !session.posType) e.posType = 'Please select a purchase type';

    if (!session.purchaseDate) e.purchaseDate = 'Please enter a purchase date';

    const today = new Date();
    if (session.purchaseDate && new Date(session.purchaseDate) > today)
      e.purchaseDate = 'Purchase date cannot be in the future';
    if (session.measurementDate && new Date(session.measurementDate) > today)
      e.measurementDate = 'Assessment date cannot be in the future';
    if (session.purchaseDate && session.measurementDate &&
        new Date(session.purchaseDate) > new Date(session.measurementDate))
      e.purchaseDate = 'Purchase date should be before or same as assessment date';

    const filledReadings = readings.filter(r => r.cropType !== '');
    if (filledReadings.length === 0) {
      e.readings_global = 'Please fill in at least one crop reading';
    } else {
      filledReadings.forEach(r => {
        if (typeof r.brixLevel !== 'number' || isNaN(r.brixLevel) || r.brixLevel < 0 || r.brixLevel > 100)
          e[`reading_${r.id}_brixLevel`] = 'BRIX must be between 0–100';
        if (!r.brandName.trim())
          e[`reading_${r.id}_brandName`] = 'Please select a brand, or choose Unknown';
        if (r.notes.length > 500)
          e[`reading_${r.id}_notes`] = 'Notes too long (max 500 characters)';
      });
    }

    setErrors(e);

    // Open the first reading with an error so the user can see it
    const firstErroredReading = readings.find(r =>
      e[`reading_${r.id}_cropType`] || e[`reading_${r.id}_brixLevel`]
    );
    if (firstErroredReading) setOpenReadingId(firstErroredReading.id);
    else if (e.readings_global) setOpenReadingId(readings[0]?.id ?? null);

    return Object.keys(e).length === 0;
  };

  // Step-1 gating for the mobile flow. Reuses the exact same checks/messages as
  // validateForm() for the trip-level fields only, so "Next" surfaces the same
  // inline errors. Does NOT touch the submit path — the whole form is still
  // validated by validateForm() on submit, unchanged.
  const validateStep1 = (): boolean => {
    const e: Record<string, string> = {};
    if (!session.location.trim()) e.location = 'Please enter a location';

    const needsVenuePrompt = session.latitude !== 0 && !session.business_name && !session.poi_name;
    if (needsVenuePrompt && !session.venueChoice) {
      e.venueChoice = 'Please select or register a place, or choose Skip';
    }
    if (needsVenuePrompt && session.venueChoice?.kind === 'register') {
      const rc = session.venueChoice as any;
      if (!rc.name?.trim()) e.venueChoice = 'Please enter a place name';
    }

    const lockedPosType =
      session.venueChoice?.kind === 'existing' && (session.venueChoice as any).posType
        ? (session.venueChoice as any).posType as string
        : null;
    if (!lockedPosType && !session.posType) e.posType = 'Please select a purchase type';

    if (!session.purchaseDate) e.purchaseDate = 'Please enter a purchase date';
    if (session.purchaseDate && new Date(session.purchaseDate) > new Date())
      e.purchaseDate = 'Purchase date cannot be in the future';

    // Overwrite just the step-1 error keys (empty string = no error shown).
    setErrors(prev => ({
      ...prev,
      location: e.location ?? '',
      venueChoice: e.venueChoice ?? '',
      posType: e.posType ?? '',
      purchaseDate: e.purchaseDate ?? '',
    }));
    return Object.keys(e).length === 0;
  };

  const handleNext = () => { if (validateStep1()) setStep(2); };

  const handleSubmit = async (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast({ title: 'Please fix the highlighted errors before submitting.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);

    const assessmentDate = new Date(
      (session.measurementDate || new Date().toISOString().split('T')[0]) + 'T00:00:00.000Z'
    ).toISOString();
    const purchaseDate = new Date(session.purchaseDate + 'T00:00:00.000Z').toISOString();

    const lockedPosType =
      session.venueChoice?.kind === 'existing' && (session.venueChoice as any).posType
        ? (session.venueChoice as any).posType as string
        : null;

    const venuePayload: Record<string, any> = {};
    if (session.venueChoice) {
      if (session.venueChoice.kind === 'existing') {
        venuePayload.venueId = session.venueChoice.venueId;
      } else if (session.venueChoice.kind === 'register') {
        venuePayload.newVenue = {
          name: session.venueChoice.name,
        };
      } else if (session.venueChoice.kind === 'skip') {
        venuePayload.skipVenuePrompt = true;
      }
    }

    if (!userWallet || !userPubKey) {
      toast({ title: 'Wallet not connected. Please log in again.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    // Sign each filled reading. Serial (not Promise.all) so wallet prompts
    // don't race and the user sees them one at a time.
    const filledReadings = readings.filter(r => r.cropType !== '');
    const signedReadings = [];
    try {
      for (const r of filledReadings) {
        const brixValue = Number(r.brixLevel.toFixed(2));
        const payload = buildSubmissionPayload({
          cropName: r.cropType,
          brixValue: r.brixLevel,
          brandName: r.brandName,
          notes: r.notes,
          assessmentDate,
          purchaseDate,
          latitude: session.latitude,
          longitude: session.longitude,
          locationName: session.location,
        });
        const sig = await signSubmissionPayload(userWallet, userPubKey, payload);
        signedReadings.push({
          cropName: r.cropType,
          brixValue,
          brandName: r.brandName || null,
          notes: r.notes || null,
          payloadJson: sig.payloadJson,
          userSignature: sig.userSignature,
          userKeyID: sig.userKeyID,
          userIdentityKey: sig.userIdentityKey,
        });
      }
    } catch (err: any) {
      toast({
        title: 'Signing failed',
        description: err?.message || 'Please approve the signature in your wallet and try again.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    try {
      const result = await apiPost<{ submissions: { submission_id: string; verified: boolean }[] }>(
        '/api/submissions/create',
        {
          assessmentDate,
          purchaseDate,
          userId: user?.id,
          latitude: session.latitude,
          longitude: session.longitude,
          locationName: session.location,
          street_address: session.street_address || null,
          city: session.city || null,
          state: session.state || null,
          country: session.country || null,
          poi_name: session.poi_name || null,
          business_name: session.business_name || null,
          normalized_address: session.normalized_address || null,
          store_name: session.business_name || session.poi_name || session.posType,
          pos_type: lockedPosType || session.posType,
          ...venuePayload,
          readings: signedReadings,
        }
      );

      const { submissions } = result;

      for (let i = 0; i < filledReadings.length; i++) {
        const reading = filledReadings[i];
        const subId = submissions[i]?.submission_id;
        if (reading.images.length === 0 || !subId) continue;
        try {
          // For each file: presigned URL → S3 PUT → collect the resulting key.
          const keys: string[] = [];
          for (const file of reading.images) {
            const { uploadUrl, key } = await getPresignedUploadUrl(subId, file.name, file.type, file.size);
            await uploadFileToS3(uploadUrl, file);
            keys.push(key);
          }
          await finalizeUpload(subId, keys);
        } catch (err) {
          console.error('Image upload error for reading', i + 1, err);
        }
      }

      const count = submissions.length;
      toast({
        title: count > 1 ? `${count} readings submitted` : 'Reading submitted',
        description: 'Thank you for contributing!',
      });
      queryClient.invalidateQueries({ queryKey: ['staticData'] });
      queryClient.invalidateQueries({ queryKey: ['submissions', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['submissions', 'public_formatted'] });
      navigate('/my-data');
    } catch (err: any) {
      toast({ title: err.message || 'Something went wrong', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user || (user.role !== 'contributor' && user.role !== 'admin')) return null;

  if (staticDataLoading) {
    return (
      <PageBackground className="min-h-screen flex items-center justify-center">
        <div className="text-center p-6">
          <Loader2 className="w-12 h-12 animate-spin mx-auto" style={{ color: 'var(--green-mid)' }} />
          <p className="mt-4" style={{ color: 'var(--text-mid)' }}>Loading form data...</p>
        </div>
      </PageBackground>
    );
  }

  const allBrands = [...brands, ...pendingBrands.map(name => ({ name, label: name }))];

  return (
    <PageBackground className="min-h-screen">
      <Header />
      <main
        className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 max-[640px]:px-3"
        style={{ paddingBottom: 'calc(7rem + var(--safe-bottom))' }}
      >
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-on-bg-text">New Measurement Entry</h1>
          <p className="mt-1 text-on-bg-body">
            Record one or more refractometer readings from a single shopping session
          </p>
        </div>

        <motion.div {...fadeUp}>
          <Card className="rounded-2xl border shadow-sm" style={{ borderColor: 'var(--hairline)' }}>
            <CardHeader
              className="rounded-t-2xl border-b hidden"
              style={{ backgroundColor: 'var(--surface-canvas)', borderColor: 'var(--hairline)' }}
            >
              <CardTitle
                className="flex items-center space-x-3 text-xl font-display font-bold"
                style={{ color: 'var(--text-dark)' }}
              >
                <div className="p-2 rounded-xl" style={{ backgroundColor: 'var(--blue-deep)' }}>
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <span>New Measurement Entry</span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-5 sm:p-8 md:p-10">
              {/* Mobile-only step indicator — inside the white widget */}
              <div className="mb-6 pb-5 border-b border-hairline">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-text-muted-brown">New Entry</p>
                  <p className="text-xs font-medium text-text-muted-brown">Step {step} of 2</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Step 1 — Shop */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step > 1 ? 'bg-select-strong text-select-strong-fg' : 'bg-select-strong text-select-strong-fg ring-4 ring-blue-pale'}`}>
                      {step > 1 ? <Check className="w-4 h-4" strokeWidth={3} /> : '1'}
                    </span>
                    <span className={`text-sm ${step === 1 ? 'font-semibold text-text-dark' : 'font-medium text-text-mid'}`}>Shop</span>
                  </div>
                  {/* Progress connector */}
                  <div className="relative flex-1 h-1.5 rounded-full bg-hairline overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-select-strong transition-all duration-300"
                      style={{ width: step >= 2 ? '100%' : '0%' }}
                    />
                  </div>
                  {/* Step 2 — Crops */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step >= 2 ? 'bg-select-strong text-select-strong-fg ring-4 ring-blue-pale' : 'border-2 border-hairline bg-card text-text-muted-brown'}`}>
                      2
                    </span>
                    <span className={`text-sm ${step === 2 ? 'font-semibold text-text-dark' : 'font-medium text-text-muted-brown'}`}>Crops</span>
                  </div>
                </div>
              </div>
              <motion.div className="space-y-10 sm:space-y-12" {...stagger}>

                {/* ── Section 1: Session context (mobile Step 1) ── */}
                <motion.div {...staggerChild} className={step !== 1 ? 'hidden' : ''}>
                  <div>
                    <FormSectionHeader title="Where did you shop?" required />

                    <div className="mb-6">
                      {/* Location */}
                      <div>
                        <Label
                          className="flex items-center gap-2 mb-2 text-sm font-semibold"
                          style={{ color: 'var(--text-mid)' }}
                        >
                          <MapPin className="w-4 h-4" />
                          Location <span className="text-destructive">*</span>
                        </Label>
                        <LocationSearch
                          value={session.location}
                          onChange={e => setSessionField('location', e.target.value)}
                          onLocationSelect={handleLocationSelect}
                        />
                        {errors.location && (
                          <p className="text-destructive text-sm mt-2 flex items-center gap-1">
                            <X className="w-4 h-4" />{errors.location}
                          </p>
                        )}
                        {/* Venue prompt — only when Mapbox returned no business name */}
                        {session.latitude !== 0 && !session.business_name && !session.poi_name && (
                          <VenuePrompt
                            latitude={session.latitude}
                            longitude={session.longitude}
                            onSelect={choice => setSessionField('venueChoice', choice)}
                            error={errors.venueChoice}
                          />
                        )}
                      </div>
                    </div>

                    {(() => {
                      const lockedPosType =
                        session.venueChoice?.kind === 'existing' && (session.venueChoice as any).posType
                          ? (session.venueChoice as any).posType as string
                          : null;
                      return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* POS type */}
                      <div>
                        <Label
                          className="flex items-center gap-2 mb-2 text-sm font-semibold"
                          style={{ color: 'var(--text-mid)' }}
                        >
                          Purchase Type <span className="text-destructive">*</span>
                        </Label>
                        {lockedPosType ? (
                          <div className="flex flex-wrap gap-2">
                            <span
                              className="px-4 py-2 rounded-full text-sm font-medium border"
                              style={{ borderColor: 'var(--select-border)', backgroundColor: 'var(--select-bg)', color: 'var(--select-fg)' }}
                            >
                              {lockedPosType}
                            </span>
                            <span className="text-xs self-center" style={{ color: 'var(--text-muted)' }}>
                              (from venue)
                            </span>
                          </div>
                        ) : (
                        <div className="flex flex-wrap gap-2">
                          {POS_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setSessionField('posType', opt.value)}
                              className="px-4 py-2 rounded-full text-sm font-medium border transition-colors"
                              style={
                                session.posType === opt.value
                                  ? { borderColor: 'var(--select-border)', backgroundColor: 'var(--select-bg)', color: 'var(--select-fg)' }
                                  : { borderColor: 'var(--field-border)', backgroundColor: 'hsl(var(--card))', color: 'var(--text-mid)' }
                              }
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        )}
                        {errors.posType && (
                          <p className="text-destructive text-sm mt-2 flex items-center gap-1">
                            <X className="w-4 h-4" />{errors.posType}
                          </p>
                        )}
                      </div>

                      {/* Purchase Date */}
                      <div>
                        <Label
                          className="flex items-center gap-2 mb-2 text-sm font-semibold"
                          style={{ color: 'var(--text-mid)' }}
                        >
                          <Calendar className="w-4 h-4" />
                          Purchase Date <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="purchaseDate"
                          type="date"
                          value={session.purchaseDate}
                          onChange={e => setSessionField('purchaseDate', e.target.value)}
                          max={new Date().toISOString().split('T')[0]}
                          className={`w-full border-2 rounded-xl px-4 py-3 bg-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-light focus-visible:ring-offset-2 ${errors.purchaseDate ? 'border-destructive bg-red-50' : 'border-input'}`}
                          style={{ color: 'var(--text-dark)' }}
                        />
                        {errors.purchaseDate && (
                          <p className="text-destructive text-sm mt-2 flex items-center gap-1">
                            <X className="w-4 h-4" />{errors.purchaseDate}
                          </p>
                        )}
                      </div>
                    </div>
                      );
                    })()}
                  </div>
                </motion.div>

                <div className="hidden" style={{ borderColor: 'var(--hairline)' }} />

                {/* ── Section 2: Crop readings (mobile Step 2) ── */}
                <motion.div {...staggerChild} className={step !== 2 ? 'hidden' : ''}>
                  {/* Mobile-only trip summary chip — Edit returns to Step 1 */}
                  <div className="mb-4 flex items-center gap-4 rounded-lg bg-surface-canvas border border-hairline px-3 py-2 text-sm">
                    <span className="flex-1 min-w-0 truncate text-text-mid">
                      <MapPin className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                      {session.posType || 'Shop'}{session.purchaseDate ? ` · ${session.purchaseDate}` : ''}
                    </span>
                    <button type="button" onClick={() => setStep(1)} className="shrink-0 font-medium text-action-primary hover:text-action-primary-hover">Edit</button>
                  </div>
                  <div>
                    <FormSectionHeader title="What did you measure?" required />
                    {errors.readings_global && (
                      <p className="text-destructive text-sm mb-4 flex items-center gap-1">
                        <X className="w-4 h-4" />{errors.readings_global}
                      </p>
                    )}

                    <div className="space-y-2">
                      {readings.map((reading, idx) => (
                        <ReadingCard
                          key={reading.id}
                          reading={reading}
                          index={idx}
                          crops={crops}
                          brands={allBrands}
                          errors={errors}
                          showRemove={readings.length > 1}
                          isOpen={openReadingId === reading.id}
                          onChange={handleReadingChange}
                          onRemove={removeReading}
                          onToggle={id => setOpenReadingId(prev => prev === id ? null : id)}
                          onAddBrand={handleAddBrand}
                          onImageUpload={handleReadingImageUpload}
                          onImageRemove={handleReadingImageRemove}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={addReading}
                      className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-colors text-text-muted border-hairline hover:border-green-fresh hover:text-green-fresh"
                    >
                      <Plus className="w-4 h-4" />
                      Add another crop
                    </button>
                  </div>
                </motion.div>

                <div className="hidden" style={{ borderColor: 'var(--hairline)' }} />

                {/* ── Section 3: Optional (mobile Step 2) ── */}
                <motion.div {...staggerChild} className={step !== 2 ? 'hidden' : ''}>
                  <div>
                    <h3 className="text-xl font-display font-bold mb-6" style={{ color: 'var(--text-dark)' }}>
                      Additional Information
                    </h3>

                    <div className="mb-6 max-w-xs">
                      <Label
                        className="flex items-center gap-2 mb-2 text-sm font-semibold"
                        style={{ color: 'var(--text-mid)' }}
                      >
                        <Clock className="w-4 h-4" />
                        Assessment Date
                      </Label>
                      <Input
                        id="measurementDate"
                        type="date"
                        value={session.measurementDate}
                        onChange={e => setSessionField('measurementDate', e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className={`w-full border-2 rounded-xl px-4 py-3 bg-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-light focus-visible:ring-offset-2 ${errors.measurementDate ? 'border-destructive bg-red-50' : 'border-input'}`}
                        style={{ color: 'var(--text-dark)' }}
                      />
                      {errors.measurementDate && (
                        <p className="text-destructive text-sm mt-2 flex items-center gap-1">
                          <X className="w-4 h-4" />{errors.measurementDate}
                        </p>
                      )}
                    </div>

                  </div>
                </motion.div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* Sticky footer */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t shadow-lg"
        style={{
          backgroundColor: 'hsl(var(--card))',
          borderColor: 'var(--hairline)',
          padding: '0.75rem 1rem',
          paddingBottom: 'calc(0.75rem + var(--safe-bottom))',
        }}
      >
        <div className="max-w-5xl mx-auto">
          {/* Desktop — unchanged single submit */}
          <div className="hidden">
            <Button
              onClick={handleSubmit}
              className="w-full sm:w-auto px-12 py-6 text-lg font-semibold rounded-xl hover:text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : readings.length > 1 ? (
                `Submit ${readings.length} Readings`
              ) : (
                'Submit Reading'
              )}
            </Button>
          </div>

          {/* Mobile — 2-step controls (same handlers; submit is unchanged) */}
          <div>
            {step === 1 ? (
              <Button
                onClick={handleNext}
                className="w-full py-6 text-base font-semibold rounded-xl hover:text-white"
              >
                Next: Crops →
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="py-6 px-5 text-base font-semibold rounded-xl"
                >
                  ← Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className="flex-1 py-6 text-base font-semibold rounded-xl hover:text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Reading →'
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageBackground>
  );
};

export default DataEntry;
