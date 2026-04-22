import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  MapPin,
  Upload,
  Loader2,
  X,
  Calendar,
  Package,
  Droplets,
  Camera,
  Clock,
  FileText,
  Plus,
  Trash2,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../hooks/use-toast';
import { apiPost, apiFetch } from '@/lib/api';
import ComboBoxAddable from '../components/ui/combo-box-addable';
import Combobox from '../components/ui/combo-box';
import LocationSearch from '../components/common/LocationSearch';
import { useStaticData } from '../hooks/useStaticData';
import { Slider } from '../components/ui/slider';
import { useCropThresholds } from '../contexts/CropThresholdContext';
import { scoreBrix } from '../lib/getBrixColor';

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

interface CropReading {
  id: string;
  cropType: string;
  brixLevel: number;
}

const POS_OPTIONS = [
  { value: 'Supermarket', label: 'Supermarket' },
  { value: 'Farmers Market', label: 'Farmers Market' },
  { value: 'Farm Direct', label: 'Farm Direct' },
  { value: 'Online', label: 'Online' },
  { value: 'Other', label: 'Other' },
];

const QUALITY_COLOR: Record<string, string> = {
  Excellent: 'var(--green-mid)',
  Good: 'var(--green-fresh)',
  Average: 'var(--gold)',
  Poor: 'var(--score-poor)',
};

const mkReading = (): CropReading => ({
  id: crypto.randomUUID(),
  cropType: '',
  brixLevel: 12,
});

// ReadingCard (accordion)

const ReadingCard: React.FC<{
  reading: CropReading;
  index: number;
  crops: { id: string; name: string; label?: string }[];
  errors: Record<string, string>;
  showRemove: boolean;
  isOpen: boolean;
  onChange: (id: string, field: keyof CropReading, value: any) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
}> = ({ reading, index, crops, errors, showRemove, isOpen, onChange, onRemove, onToggle }) => {
  const prefersReducedMotion = useReducedMotion();
  const { cache } = useCropThresholds();
  const thresholds = reading.cropType ? (cache[reading.cropType] ?? null) : null;
  const score = scoreBrix(reading.brixLevel, thresholds);
  const tierColor = QUALITY_COLOR[score.quality] ?? 'var(--score-poor)';
  const tierLabel = score.quality;
  const cropLabel = crops.find(c => c.name === reading.cropType)?.label || reading.cropType;
  const hasError = !!(errors[`reading_${reading.id}_cropType`] || errors[`reading_${reading.id}_brixLevel`]);

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: hasError ? 'var(--score-poor)' : 'var(--green-pale)', backgroundColor: 'hsl(var(--card))' }}
    >
      {/* Accordion header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggle(reading.id)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(reading.id); } }}
        className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-green-mist transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: hasError ? 'var(--score-poor)' : 'var(--green-fresh)' }}
          >
            {index + 1}
          </span>
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-mid)' }}>
            {cropLabel || 'New reading'}
          </span>
          {!isOpen && reading.cropType && (
            <span className="hidden sm:flex items-center gap-1.5 ml-1 text-xs" style={{ color: tierColor }}>
              · {reading.brixLevel} BRIX · {tierLabel}
            </span>
          )}
          {!isOpen && hasError && (
            <span className="text-xs ml-1" style={{ color: 'var(--score-poor)' }}>— incomplete</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {showRemove && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRemove(reading.id); }}
              className="p-1.5 rounded-lg text-destructive hover:opacity-70 transition-opacity"
              aria-label="Remove reading"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-muted)' }}
          />
        </div>
      </div>

      {/* Animated body */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-5 border-t space-y-4" style={{ borderColor: 'var(--green-pale)' }}>
              {/* Crop Type */}
              <div className="pt-4">
                <Label
                  className="flex items-center gap-1 mb-1.5 text-xs font-semibold"
                  style={{ color: 'var(--text-mid)' }}
                >
                  <Package className="w-3.5 h-3.5" />
                  Crop Type <span className="text-destructive ml-0.5">*</span>
                </Label>
                <Combobox
                  items={crops}
                  value={reading.cropType}
                  onSelect={val => onChange(reading.id, 'cropType', val)}
                  placeholder="Select crop type"
                />
                {errors[`reading_${reading.id}_cropType`] && (
                  <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                    <X className="w-3 h-3" />{errors[`reading_${reading.id}_cropType`]}
                  </p>
                )}
              </div>

              {/* BRIX */}
              <div>
                <Label
                  className="flex items-center gap-1 mb-2 text-xs font-semibold"
                  style={{ color: 'var(--text-mid)' }}
                >
                  <Droplets className="w-3.5 h-3.5" style={{ color: tierColor }} />
                  BRIX Reading <span className="text-destructive ml-0.5">*</span>
                </Label>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center shrink-0">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      inputMode="decimal"
                      value={isNaN(reading.brixLevel) ? '' : reading.brixLevel}
                      onChange={e => {
                        const parsed = parseFloat(e.target.value);
                        onChange(reading.id, 'brixLevel', isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), 100));
                      }}
                      className="w-20 text-center border-2 rounded-xl px-2 py-2 font-display font-bold text-lg transition-all border-input focus:border-green-fresh bg-card focus:outline-none"
                      style={{ color: tierColor }}
                    />
                    <span className="text-xs font-medium mt-1" style={{ color: tierColor }}>{tierLabel}</span>
                  </div>
                  <Slider
                    value={[reading.brixLevel]}
                    onValueChange={([v]) => onChange(reading.id, 'brixLevel', Math.min(Math.max(v, 0), 100))}
                    max={100}
                    step={0.1}
                    className="flex-1"
                  />
                </div>
                {errors[`reading_${reading.id}_brixLevel`] && (
                  <p className="text-destructive text-xs mt-1 flex items-center gap-1">
                    <X className="w-3 h-3" />{errors[`reading_${reading.id}_brixLevel`]}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// DataEntry

const DataEntry = () => {
  const { user } = useAuth();
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
    brand: '',
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
    outlierNotes: '',
    images: [] as File[],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingBrands, setPendingBrands] = useState<string[]>([]);

  useEffect(() => {
    if (!user || (user.role !== 'contributor' && user.role !== 'admin')) {
      navigate('/');
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
    }));
    if (errors.location) setErrors(prev => ({ ...prev, location: '' }));
  };

  const handleAddBrand = (name: string) => {
    if (!pendingBrands.includes(name)) setPendingBrands(prev => [...prev, name]);
    setSessionField('brand', name);
  };

  const validateFile = (file: File): boolean => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrors(prev => ({ ...prev, images: 'Only JPEG, PNG, and WebP images are allowed' }));
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, images: 'File size must be less than 5MB' }));
      return false;
    }
    return true;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid: File[] = [];
    let hasErr = false;
    files.forEach(f => { if (validateFile(f)) valid.push(f); else hasErr = true; });
    if (valid.length + session.images.length > 3) {
      setErrors(prev => ({ ...prev, images: 'Maximum 3 images allowed' }));
      return;
    }
    if (hasErr) {
      toast({ title: 'File upload error', description: 'Some files were too large or not supported.', variant: 'destructive' });
      return;
    }
    setSessionField('images', [...session.images, ...valid]);
  };

  const validateForm = (): boolean => {
    const e: Record<string, string> = {};
    if (!session.brand.trim()) e.brand = 'Please select a farm or brand';
    if (!session.location.trim()) e.location = 'Please enter a location';
    if (!session.posType) e.posType = 'Please select a purchase type';
    if (!session.purchaseDate) e.purchaseDate = 'Please enter a purchase date';

    const today = new Date();
    if (session.purchaseDate && new Date(session.purchaseDate) > today)
      e.purchaseDate = 'Purchase date cannot be in the future';
    if (session.measurementDate && new Date(session.measurementDate) > today)
      e.measurementDate = 'Assessment date cannot be in the future';
    if (session.purchaseDate && session.measurementDate &&
        new Date(session.purchaseDate) > new Date(session.measurementDate))
      e.purchaseDate = 'Purchase date should be before or same as assessment date';
    if (session.outlierNotes.length > 500) e.outlierNotes = 'Notes too long (max 500 characters)';

    const filledReadings = readings.filter(r => r.cropType !== '');
    if (filledReadings.length === 0) {
      e.readings_global = 'Please fill in at least one crop reading';
    } else {
      filledReadings.forEach(r => {
        if (typeof r.brixLevel !== 'number' || isNaN(r.brixLevel) || r.brixLevel < 0 || r.brixLevel > 100)
          e[`reading_${r.id}_brixLevel`] = 'BRIX must be between 0–100';
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

    try {
      const result = await apiPost<{ submissions: { submission_id: string; verified: boolean }[] }>(
        '/api/submissions/create',
        {
          brandName: session.brand,
          assessmentDate,
          purchaseDate,
          outlierNotes: session.outlierNotes,
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
          pos_type: session.posType,
          readings: readings
            .filter(r => r.cropType !== '')
            .map(r => ({
              cropName: r.cropType,
              brixValue: Number(r.brixLevel.toFixed(2)),
            })),
        }
      );

      const { submissions } = result;
      const firstId = submissions[0]?.submission_id;

      if (session.images.length > 0 && firstId) {
        const fd = new FormData();
        fd.append('submission_id', firstId);
        session.images.forEach(f => fd.append('images', f));
        try {
          const res = await apiFetch('/api/upload', { method: 'POST', body: fd });
          if (!res.ok) console.error('Image upload failed');
        } catch (err) {
          console.error('Image upload error:', err);
        }
      }

      const count = submissions.length;
      toast({
        title: count > 1 ? `${count} readings submitted` : 'Reading submitted',
        description: 'Thank you for contributing!',
      });
      queryClient.invalidateQueries({ queryKey: ['staticData'] });
      queryClient.invalidateQueries({ queryKey: ['submissions', 'mine'] });
      navigate('/your-data');
    } catch (err: any) {
      toast({ title: err.message || 'Something went wrong', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user || (user.role !== 'contributor' && user.role !== 'admin')) return null;

  if (staticDataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--cream)' }}>
        <div className="text-center p-6">
          <Loader2 className="w-12 h-12 animate-spin mx-auto" style={{ color: 'var(--green-mid)' }} />
          <p className="mt-4" style={{ color: 'var(--text-mid)' }}>Loading form data...</p>
        </div>
      </div>
    );
  }

  const allBrands = [...brands, ...pendingBrands.map(name => ({ name, label: name }))];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--cream)' }}>
      <Header />
      <main
        className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8"
        style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 1rem))' }}
      >
        <motion.div className="text-center mb-8 md:mb-12" {...fadeUp}>
          <p className="uppercase tracking-[0.2em] text-sm font-medium mb-2" style={{ color: 'var(--green-fresh)' }}>
            New Entry
          </p>
          <h1 className="text-3xl sm:text-4xl font-display font-bold mb-2" style={{ color: 'var(--text-dark)' }}>
            Submit BRIX Reading
          </h1>
          <p className="text-md max-w-2xl mx-auto" style={{ color: 'var(--text-mid)' }}>
            Record one or more refractometer readings from a single shopping session
          </p>
        </motion.div>

        <motion.div {...fadeUp}>
          <Card className="rounded-2xl border shadow-sm" style={{ borderColor: 'var(--green-pale)' }}>
            <CardHeader
              className="rounded-t-2xl border-b"
              style={{ backgroundColor: 'var(--green-mist)', borderColor: 'var(--green-pale)' }}
            >
              <CardTitle
                className="flex items-center space-x-3 text-xl font-display font-bold"
                style={{ color: 'var(--text-dark)' }}
              >
                <div className="p-2 rounded-xl" style={{ backgroundColor: 'var(--green-deep)' }}>
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <span>New Measurement Entry</span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-5 sm:p-8 md:p-10">
              <motion.div className="space-y-10 sm:space-y-12" {...stagger}>

                {/* ── Section 1: Session context ── */}
                <motion.div {...staggerChild}>
                  <div className="border-l-4 pl-5 sm:pl-8" style={{ borderColor: 'var(--green-fresh)' }}>
                    <div className="flex items-center gap-3 mb-6">
                      <h3 className="text-xl font-display font-bold" style={{ color: 'var(--text-dark)' }}>
                        Where did you shop?
                      </h3>
                      <span
                        className="px-3 py-1 text-sm font-medium rounded-full"
                        style={{ backgroundColor: 'var(--green-pale)', color: 'var(--green-mid)' }}
                      >
                        Required
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
                      </div>

                      {/* Brand / Farm */}
                      <div>
                        <Label
                          className="flex items-center gap-2 mb-2 text-sm font-semibold"
                          style={{ color: 'var(--text-mid)' }}
                        >
                          <Building2 className="w-4 h-4 text-green-fresh" />
                          Farm / Brand Name <span className="text-destructive">*</span>
                        </Label>
                        <ComboBoxAddable
                          items={allBrands}
                          value={session.brand}
                          onSelect={val => setSessionField('brand', val)}
                          onAddNew={handleAddBrand}
                          placeholder="Select or enter farm/brand name"
                        />
                        {errors.brand && (
                          <p className="text-destructive text-sm mt-2 flex items-center gap-1">
                            <X className="w-4 h-4" />{errors.brand}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* POS type */}
                      <div>
                        <Label
                          className="flex items-center gap-2 mb-2 text-sm font-semibold"
                          style={{ color: 'var(--text-mid)' }}
                        >
                          Purchase Type <span className="text-destructive">*</span>
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {POS_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setSessionField('posType', opt.value)}
                              className="px-4 py-2 rounded-full text-sm font-medium border transition-colors"
                              style={
                                session.posType === opt.value
                                  ? { borderColor: 'var(--green-fresh)', backgroundColor: 'var(--green-fresh)', color: '#fff' }
                                  : { borderColor: 'var(--green-pale)', backgroundColor: 'hsl(var(--card))', color: 'var(--text-mid)' }
                              }
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
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
                          className={`w-full border-2 rounded-xl px-4 py-3 transition-all hover:border-green-light focus:outline-none focus:ring-4 focus:ring-green-pale ${errors.purchaseDate ? 'border-destructive bg-red-50' : 'border-input focus:border-green-fresh bg-card'}`}
                          style={{ color: 'var(--text-dark)' }}
                        />
                        {errors.purchaseDate && (
                          <p className="text-destructive text-sm mt-2 flex items-center gap-1">
                            <X className="w-4 h-4" />{errors.purchaseDate}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>

                <div className="border-t" style={{ borderColor: 'var(--green-pale)' }} />

                {/* ── Section 2: Crop readings ── */}
                <motion.div {...staggerChild}>
                  <div className="border-l-4 pl-5 sm:pl-8" style={{ borderColor: 'var(--green-light)' }}>
                    <div className="flex items-center gap-3 mb-6">
                      <h3 className="text-xl font-display font-bold" style={{ color: 'var(--text-dark)' }}>
                        What did you measure?
                      </h3>
                      <span
                        className="px-3 py-1 text-sm font-medium rounded-full"
                        style={{ backgroundColor: 'var(--green-pale)', color: 'var(--green-mid)' }}
                      >
                        Required
                      </span>
                    </div>
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
                          errors={errors}
                          showRemove={readings.length > 1}
                          isOpen={openReadingId === reading.id}
                          onChange={handleReadingChange}
                          onRemove={removeReading}
                          onToggle={id => setOpenReadingId(prev => prev === id ? null : id)}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={addReading}
                      className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-colors text-text-muted border-green-pale hover:border-green-fresh hover:text-green-fresh"
                    >
                      <Plus className="w-4 h-4" />
                      Add another crop
                    </button>
                  </div>
                </motion.div>

                <div className="border-t" style={{ borderColor: 'var(--green-pale)' }} />

                {/* ── Section 3: Optional ── */}
                <motion.div {...staggerChild}>
                  <div className="border-l-4 pl-5 sm:pl-8" style={{ borderColor: 'var(--green-pale)' }}>
                    <h3 className="text-xl font-display font-bold mb-6" style={{ color: 'var(--text-dark)' }}>
                      Additional Information
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
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
                          className={`w-full border-2 rounded-xl px-4 py-3 transition-all hover:border-green-light focus:outline-none focus:ring-4 focus:ring-green-pale ${errors.measurementDate ? 'border-destructive bg-red-50' : 'border-input focus:border-green-fresh bg-card'}`}
                          style={{ color: 'var(--text-dark)' }}
                        />
                        {errors.measurementDate && (
                          <p className="text-destructive text-sm mt-2 flex items-center gap-1">
                            <X className="w-4 h-4" />{errors.measurementDate}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label
                          className="flex items-center gap-2 mb-2 text-sm font-semibold"
                          style={{ color: 'var(--text-mid)' }}
                        >
                          <FileText className="w-4 h-4" />
                          Notes / Observations
                        </Label>
                        <Textarea
                          id="outlierNotes"
                          placeholder="Describe any anomalies or interesting details."
                          value={session.outlierNotes}
                          onChange={e => setSessionField('outlierNotes', e.target.value)}
                          rows={3}
                          className={`w-full border-2 rounded-xl px-4 py-3 transition-all hover:border-green-light focus:outline-none focus:ring-4 focus:ring-green-pale ${errors.outlierNotes ? 'border-destructive bg-red-50' : 'border-input focus:border-green-fresh bg-card'}`}
                          style={{ color: 'var(--text-dark)' }}
                        />
                        {errors.outlierNotes && (
                          <p className="text-destructive text-sm mt-2 flex items-center gap-1">
                            <X className="w-4 h-4" />{errors.outlierNotes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Images */}
                    <div>
                      <Label
                        className="flex items-center gap-2 mb-3 text-sm font-semibold"
                        style={{ color: 'var(--text-mid)' }}
                      >
                        <Camera className="w-4 h-4" />
                        Photos
                        <span className="font-normal ml-1" style={{ color: 'var(--text-muted)' }}>
                          (max 3, up to 5 MB each)
                        </span>
                      </Label>
                      <div className="flex flex-wrap items-center gap-3">
                        {session.images.map((file, i) => (
                          <div
                            key={i}
                            className="relative w-24 h-24 rounded-xl overflow-hidden border-2 group"
                            style={{ borderColor: 'var(--green-pale)' }}
                          >
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`Preview ${i + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => setSessionField('images', session.images.filter((_, j) => j !== i))}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        {session.images.length < 3 && (
                          <Label
                            htmlFor="image-upload"
                            className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer hover:border-green-fresh transition-colors"
                            style={{ borderColor: 'var(--green-pale)', color: 'var(--text-muted)' }}
                          >
                            <Camera className="w-6 h-6 mb-1" />
                            <span className="text-xs text-center">Add Photo</span>
                            <Input
                              id="image-upload"
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              multiple
                              onChange={handleImageUpload}
                              className="sr-only"
                            />
                          </Label>
                        )}
                      </div>
                      {errors.images && (
                        <p className="text-destructive text-sm mt-2 flex items-center gap-1">
                          <X className="w-4 h-4" />{errors.images}
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
          backgroundColor: 'var(--cream)',
          borderColor: 'var(--green-pale)',
          padding: '0.75rem 1rem',
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0.5rem))',
        }}
      >
        <div className="max-w-5xl mx-auto flex justify-end">
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
      </div>
    </div>
  );
};

export default DataEntry;
