import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
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
  Store,
  Droplets,
  Camera,
  Clock,
  FileText,
  Info,
  Building2
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../hooks/use-toast';
import { apiPost, apiFetch } from '@/lib/api';
import ComboBoxAddable from '../components/ui/combo-box-addable';
import Combobox from '../components/ui/combo-box';
import LocationSearch from '../components/common/LocationSearch';
import { useStaticData } from '../hooks/useStaticData';
import { Slider } from '../components/ui/slider';

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

// Human-readable labels for validation/labels
const FIELD_LABELS: Record<string, string> = {
  cropType: 'Crop Type',
  brand: 'Farm/Brand Name',
  store: 'Point of Purchase',
  location: 'Sample Location',
  purchaseDate: 'Purchase Date',
  measurementDate: 'Assessment Date',
  brixLevel: 'BRIX Level',
  outlierNotes: 'Notes/Observations',
  images: 'Images',
};

/** Returns color + label for a BRIX score tier */
const getBrixTierStyle = (value: number): { color: string; label: string } => {
  if (value >= 16) return { color: 'var(--green-mid)', label: 'Excellent' };
  if (value >= 8) return { color: 'var(--gold)', label: 'Good' };
  return { color: 'var(--score-poor)', label: 'Poor' };
};

const DataEntry = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();

  const fadeUp = prefersReducedMotion ? {} : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } };
  const stagger = prefersReducedMotion ? {} : { initial: 'hidden' as const, animate: 'visible' as const, variants: { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } } };
  const staggerChild = prefersReducedMotion ? {} : { variants: { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } } };

  const { crops, brands, locations, isLoading: staticDataLoading, error: staticDataError, refreshData } = useStaticData();

  const [formData, setFormData] = useState({
    cropType: '',
    variety: '',
    brixLevel: 12,
    latitude: 0,
    longitude: 0,
    location: '',
    street_address: '',
    city: '',
    state: '',
    country: '',
    poi_name: '',
    business_name: '',
    normalized_address: '',
    measurementDate: new Date().toISOString().split('T')[0],
    purchaseDate: '',
    outlierNotes: '',
    brand: '',
    store: '',
    images: [] as File[],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Track pending additions to prevent database additions before form submission
  const [pendingBrands, setPendingBrands] = useState<string[]>([]);
  const [pendingStores, setPendingStores] = useState<string[]>([]);

  useEffect(() => {
    if (!user || (user.role !== 'contributor' && user.role !== 'admin')) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (staticDataError) {
      toast({
        title: 'Error loading form options',
        description: staticDataError,
        variant: 'destructive',
      });
    }
  }, [staticDataError, toast]);

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleBrixChange = (value: number | number[]) => {
    const brixValue = Array.isArray(value) ? value[0] : value;

    if (typeof brixValue !== 'number' || isNaN(brixValue)) {
      handleInputChange('brixLevel', 0);
    } else {
      handleInputChange('brixLevel', Math.min(Math.max(brixValue, 0), 100));
    }

    if (errors.brixLevel) {
      setErrors(prev => ({ ...prev, brixLevel: '' }));
    }
  };

  // Modified brand handler - only adds to pending list
  const handleAddBrand = (newBrandName: string) => {
    if (!pendingBrands.includes(newBrandName)) {
      setPendingBrands(prev => [...prev, newBrandName]);
    }
    handleInputChange('brand', newBrandName);
  };

  // Modified store handler - only adds to pending list
  const handleAddStore = (newStoreName: string) => {
    if (!pendingStores.includes(newStoreName)) {
      setPendingStores(prev => [...prev, newStoreName]);
    }
    handleInputChange('store', newStoreName);
  };

  // Helper function to actually create brands and stores in database
  // Note: The auto-verify-submission endpoint handles brand/location creation server-side,
  // so this is now a no-op. Pending entries are passed in the submission payload.
  const createPendingEntries = async () => {
    return { createdBrands: [], createdStores: [] };
  };

  const validateFile = (file: File): boolean => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (!allowedTypes.includes(file.type)) {
      setErrors(prev => ({ ...prev, images: 'Only JPEG, PNG, and WebP images are allowed' }));
      return false;
    }
    if (file.size > maxSize) {
      setErrors(prev => ({ ...prev, images: 'File size must be less than 5MB' }));
      return false;
    }
    return true;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles: File[] = [];
    let hasErrors = false;
    files.forEach((file) => {
      if (validateFile(file)) {
        validFiles.push(file);
      } else {
        hasErrors = true;
      }
    });
    if (validFiles.length + formData.images.length > 3) {
      setErrors(prev => ({ ...prev, images: 'Maximum 3 images allowed' }));
      return;
    }
    if (hasErrors) {
      toast({
        title: "File upload error",
        description: "Some files were too large or not supported. Please fix before submitting.",
        variant: "destructive",
      });
      return;
    }
    handleInputChange('images', [...formData.images, ...validFiles]);
  };

  const removeImage = (index: number) => {
    handleInputChange('images', formData.images.filter((_, i) => i !== index));
  };

  const handleLocationSelect = (location: DetailedLocationInfo) => {
    setFormData(prev => ({
      ...prev,
      location: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      street_address: location.street_address || '',
      city: location.city || '',
      state: location.state || '',
      country: location.country || '',
      poi_name: location.poi_name || '',
      business_name: location.business_name || '',
      normalized_address: location.normalized_address || '',
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    const requiredFields: (keyof typeof formData)[] = ['cropType', 'brand', 'store', 'location', 'purchaseDate', 'measurementDate'];
    requiredFields.forEach(field => {
      const value = formData[field];
      if (typeof value === 'string' && !value.trim()) {
        newErrors[field] = `Please select ${FIELD_LABELS[field] || field}`;
      }
    });

    if (typeof formData.brixLevel !== 'number' || isNaN(formData.brixLevel)) {
      newErrors.brixLevel = 'Please enter a valid BRIX value';
    } else if (formData.brixLevel < 0 || formData.brixLevel > 100) {
      newErrors.brixLevel = 'BRIX must be between 0–100';
    }

    const today = new Date();
    const purchaseDate = new Date(formData.purchaseDate);
    const measurementDate = new Date(formData.measurementDate);

    if (purchaseDate > today) newErrors.purchaseDate = 'Purchase date cannot be in the future';
    if (measurementDate > today) newErrors.measurementDate = 'Assessment date cannot be in the future';

    if (purchaseDate > measurementDate) {
      newErrors.purchaseDate = 'Purchase date should be before or same as assessment date';
    }

    if (formData.outlierNotes.length > 500) newErrors.outlierNotes = 'Notes too long (max 500 characters)';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateForm()) {
      // scroll to first errored field
      const firstErrorKey = Object.keys(errors)[0];
      if (firstErrorKey) {
        const el = document.getElementById(firstErrorKey);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus?.();
        }
      }
      toast({
        title: "Submission blocked",
        description: "Please correct the highlighted errors before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // First, create any pending brands and stores in the database
      await createPendingEntries();

      // Clear pending lists since we've now created them
      setPendingBrands([]);
      setPendingStores([]);

      // Prepare the enhanced payload with detailed location information
      const payload = {
        cropName: formData.cropType,
        brandName: formData.brand,
        variety: formData.variety,
        brixValue: Number.isFinite(formData.brixLevel)
          ? Number(formData.brixLevel.toFixed(2))
          : 0,
        assessmentDate: new Date(formData.measurementDate + 'T00:00:00.000Z').toISOString(),
        purchaseDate: new Date(formData.purchaseDate + 'T00:00:00.000Z').toISOString(),
        outlierNotes: formData.outlierNotes,
        userId: user?.id,
        // Enhanced location data from Mapbox geocoding
        latitude: formData.latitude,
        longitude: formData.longitude,
        locationName: formData.location,
        street_address: formData.street_address || null,
        city: formData.city || null,
        state: formData.state || null,
        country: formData.country || null,
        poi_name: formData.poi_name || null,
        business_name: formData.business_name || null,
        normalized_address: formData.normalized_address || null,
        store_name: formData.store,
      };

      // Submit to Express backend
      const result = await apiPost<{ verified: boolean; submission_id: string }>(
        '/api/submissions/create',
        payload
      );

      const { verified, submission_id } = result;

      if (!submission_id) {
        throw new Error('Submission ID was not returned by the server.');
      }

      // Handle image uploads via Express backend
      if (formData.images.length > 0) {
        const uploadData = new FormData();
        uploadData.append('submission_id', submission_id);
        for (const file of formData.images) {
          uploadData.append('images', file);
        }

        try {
          const uploadRes = await apiFetch('/api/upload', {
            method: 'POST',
            body: uploadData,
          });

          if (!uploadRes.ok) {
            const uploadErr = await uploadRes.json().catch(() => ({}));
            console.error('Image upload failed:', uploadErr);
            toast({
              title: 'Image upload failed',
              description: uploadErr.error || 'Some images could not be uploaded.',
              variant: 'destructive',
            });
          }
        } catch (uploadErr) {
          console.error('Image upload error:', uploadErr);
        }
      }

      if (verified) {
        toast({
          title: 'Submission successful',
          description: 'Your BRIX reading was auto-verified. Thank you for contributing!',
          variant: 'default'
        });
      } else {
        toast({
          title: 'Submission received',
          description: 'Your BRIX reading will be reviewed by an admin shortly.',
          variant: 'default'
        });
      }

      queryClient.invalidateQueries({ queryKey: ['staticData'] });
      queryClient.invalidateQueries({ queryKey: ['submissions', 'mine'] });
      navigate('/your-data');
    } catch (err: any) {
      console.error(err);
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
          <Loader2 className="w-12 h-12 animate-spin mx-auto" style={{ color: 'var(--green-fresh)' }} />
          <p className="mt-4" style={{ color: 'var(--text-mid)' }}>Loading form data...</p>
        </div>
      </div>
    );
  }

  // Combine existing items with pending items for display
  const allBrands = [
    ...brands,
    ...pendingBrands.map(name => ({ name, label: name }))
  ];

  const allStores = [
    ...locations,
    ...pendingStores.map(name => ({ name, label: name }))
  ];

  const brixTier = getBrixTierStyle(formData.brixLevel);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--cream)' }}>
      <Header />
      <main className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 pb-24">
        <motion.div className="text-center mb-8 md:mb-12" {...fadeUp}>
          <p className="uppercase tracking-[0.2em] text-sm font-medium mb-2" style={{ color: 'var(--green-fresh)' }}>
            New Entry
          </p>
          <h1 className="text-3xl sm:text-4xl font-display font-bold mb-2" style={{ color: 'var(--text-dark)' }}>
            Submit BRIX Measurement
          </h1>
          <p className="text-md max-w-2xl mx-auto" style={{ color: 'var(--text-mid)' }}>
            Record your bionutrient density measurement from refractometer readings
          </p>
        </motion.div>

        <motion.div {...fadeUp}>
          <Card className="rounded-2xl border shadow-sm" style={{ borderColor: 'var(--green-pale)' }}>
            <CardHeader className="rounded-t-2xl border-b" style={{ backgroundColor: 'var(--green-mist)', borderColor: 'var(--green-pale)' }}>
              <CardTitle className="flex items-center space-x-3 text-xl font-display font-bold" style={{ color: 'var(--text-dark)' }}>
                <div className="p-2 rounded-xl" style={{ backgroundColor: 'var(--green-deep)' }}>
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <span>New Measurement Entry</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 sm:p-8 md:p-10">
              <motion.form className="space-y-10 sm:space-y-12" autoComplete="off" {...stagger}>
                <motion.div className="border-l-4 pl-5 sm:pl-8" style={{ borderColor: 'var(--green-fresh)' }} {...staggerChild}>
                  <div className="flex items-center space-x-2 mb-8">
                    <h3 className="text-xl font-display font-bold" style={{ color: 'var(--text-dark)' }}>Required Information</h3>
                    <div className="px-3 py-1 text-sm font-medium rounded-full" style={{ backgroundColor: 'var(--green-pale)', color: 'var(--green-mid)' }}>
                      Required
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 mb-8 sm:mb-10">
                    {/* Crop Type - Using regular Combobox (no add new) */}
                    <div className="relative">
                      <Label htmlFor="cropType" className="flex items-center mb-2 text-sm font-semibold" style={{ color: 'var(--text-mid)' }}>
                        <Package className="inline w-4 h-4 mr-2" />
                        Crop Type <span className="ml-1 text-destructive">*</span>
                      </Label>
                      <Combobox
                        items={crops}
                        value={formData.cropType}
                        onSelect={(value) => handleInputChange('cropType', value)}
                        placeholder="Select crop type"
                      />
                      {errors.cropType && <p className="text-destructive text-sm mt-2 flex items-center"><X className="w-4 h-4 mr-1" />{errors.cropType}</p>}
                    </div>

                    {/* Brand/Farm Name */}
                    <div className="relative">
                      <Label
                        htmlFor="brand"
                        className="flex items-center mb-2 text-sm font-semibold"
                        style={{ color: 'var(--text-mid)' }}
                      >
                        <Building2 className="inline w-4 h-4 mr-2 text-green-fresh" />
                        Farm / Brand Name <span className="ml-1 text-destructive">*</span>
                      </Label>
                      <ComboBoxAddable
                        items={allBrands}
                        value={formData.brand}
                        onSelect={(value) => handleInputChange('brand', value)}
                        onAddNew={handleAddBrand}
                        placeholder="Select or enter farm/brand name"
                      />
                      <div className="flex gap-2 text-xs mt-3 px-3 py-2 rounded-lg border leading-relaxed" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--green-mist)', borderColor: 'var(--green-pale)' }}>
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--green-fresh)' }} />
                        <span>
                          The name of the <b>farm</b> or <b>brand</b> that grew the produce.{' '}
                          <span className="hidden sm:inline">
                            Press <kbd className="px-1 border rounded">Enter</kbd> to select,{' '}
                            <kbd className="px-1 border rounded">Shift+Enter</kbd> (or tap <b>+</b> on mobile) to add new.
                          </span>
                        </span>
                      </div>
                      {errors.brand && (
                        <p className="text-destructive text-sm mt-2 flex items-center">
                          <X className="w-4 h-4 mr-1" />
                          {errors.brand}
                        </p>
                      )}
                    </div>

                    {/* Point of Purchase */}
                    <div className="relative">
                      <Label
                        htmlFor="store"
                        className="flex items-center mb-2 text-sm font-semibold"
                        style={{ color: 'var(--text-mid)' }}
                      >
                        <Store className="inline w-4 h-4 mr-2 text-green-fresh" />
                        Point of Purchase <span className="ml-1 text-destructive">*</span>
                      </Label>
                      <ComboBoxAddable
                        items={allStores}
                        value={formData.store}
                        onSelect={(value) => handleInputChange('store', value)}
                        onAddNew={handleAddStore}
                        placeholder="Select or enter point of purchase"
                      />
                      <div className="flex gap-2 text-xs mt-3 px-3 py-2 rounded-lg border leading-relaxed" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--green-mist)', borderColor: 'var(--green-pale)' }}>
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--green-fresh)' }} />
                        <span>
                          Where you <b>purchased</b> the item — e.g., grocery store,
                          co-op, farmers market, or CSA pickup.
                        </span>
                      </div>
                      {errors.store && (
                        <p className="text-destructive text-sm mt-2 flex items-center">
                          <X className="w-4 h-4 mr-1" />
                          {errors.store}
                        </p>
                      )}
                    </div>

                    {/* BRIX Level */}
                    <div>
                      <Label htmlFor="brixLevel" className="flex items-center mb-2 text-sm font-semibold" style={{ color: 'var(--text-mid)' }}>
                        <Droplets className="inline w-4 h-4 mr-2" style={{ color: brixTier.color }} />
                        BRIX Level <span className="ml-1 text-destructive">*</span>
                      </Label>
                      <div className="flex items-center space-x-4">
                        <div className="flex flex-col items-center">
                          <Input
                            id="brixLevel"
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            inputMode="decimal"
                            value={isNaN(formData.brixLevel) ? '' : formData.brixLevel}
                            onChange={(e) => {
                              const parsed = parseFloat(e.target.value);
                              handleBrixChange(isNaN(parsed) ? 0 : parsed);
                            }}
                            className={`w-24 text-center border-2 rounded-xl px-2 py-2 font-display font-bold text-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-green-pale hover:border-green-light ${errors.brixLevel ? 'border-destructive bg-red-50 focus:border-destructive' : 'border-input focus:border-green-fresh bg-card'}`}
                            style={{ color: brixTier.color }}
                          />
                          <span className="text-xs font-medium mt-1" style={{ color: brixTier.color }}>
                            {brixTier.label}
                          </span>
                        </div>
                        <Slider
                          value={[formData.brixLevel]}
                          onValueChange={handleBrixChange}
                          max={100}
                          step={0.1}
                          className="flex-1"
                        />
                      </div>
                      {errors.brixLevel && <p className="text-destructive text-sm mt-2 flex items-center"><X className="w-4 h-4 mr-1" />{errors.brixLevel}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 mb-8 sm:mb-10">
                    {/* Location - using the enhanced LocationSearch component */}
                    <div className="relative">
                      <Label htmlFor="location" className="flex items-center mb-2 text-sm font-semibold" style={{ color: 'var(--text-mid)' }}>
                        <MapPin className="inline w-4 h-4 mr-2" />
                        Sample Location <span className="ml-1 text-destructive">*</span>
                      </Label>
                      <LocationSearch
                        value={formData.location}
                        onChange={e => handleInputChange('location', e.target.value)}
                        onLocationSelect={handleLocationSelect}
                      />
                      {errors.location && <p className="text-destructive text-sm mt-2 flex items-center"><X className="w-4 h-4 mr-1" />{errors.location}</p>}
                    </div>

                    {/* Purchase Date */}
                    <div>
                      <Label htmlFor="purchaseDate" className="flex items-center mb-2 text-sm font-semibold" style={{ color: 'var(--text-mid)' }}>
                        <Calendar className="inline w-4 h-4 mr-2" />
                        Purchase Date <span className="ml-1 text-destructive">*</span>
                      </Label>
                      <Input
                        id="purchaseDate"
                        type="date"
                        value={formData.purchaseDate}
                        onChange={e => handleInputChange('purchaseDate', e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className={`w-full border-2 rounded-xl px-4 py-3 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-green-pale hover:border-green-light ${errors.purchaseDate ? 'border-destructive bg-red-50 focus:border-destructive' : 'border-input focus:border-green-fresh bg-card'}`}
                        style={{ color: 'var(--text-dark)' }}
                      />
                      {errors.purchaseDate && <p className="text-destructive text-sm mt-2 flex items-center"><X className="w-4 h-4 mr-1" />{errors.purchaseDate}</p>}
                    </div>
                  </div>
                </motion.div>

                {/* Optional Fields Section */}
                <motion.div className="border-l-4 pl-5 sm:pl-8" style={{ borderColor: 'var(--green-pale)' }} {...staggerChild}>
                  <h3 className="text-xl font-display font-bold mb-8" style={{ color: 'var(--text-dark)' }}>Additional Information</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-10 mb-8 sm:mb-10">
                    {/* Measurement Date */}
                    <div>
                      <Label htmlFor="measurementDate" className="flex items-center mb-2 text-sm font-semibold" style={{ color: 'var(--text-mid)' }}>
                        <Clock className="inline w-4 h-4 mr-2" />
                        Assessment Date
                      </Label>
                      <Input
                        id="measurementDate"
                        type="date"
                        value={formData.measurementDate}
                        onChange={e => handleInputChange('measurementDate', e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className={`w-full border-2 rounded-xl px-4 py-3 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-green-pale hover:border-green-light ${errors.measurementDate ? 'border-destructive bg-red-50 focus:border-destructive' : 'border-input focus:border-green-fresh bg-card'}`}
                        style={{ color: 'var(--text-dark)' }}
                      />
                      {errors.measurementDate && <p className="text-destructive text-sm mt-2 flex items-center"><X className="w-4 h-4 mr-1" />{errors.measurementDate}</p>}
                    </div>

                    {/* Variety */}
                    <div>
                      <Label htmlFor="variety" className="flex items-center mb-2 text-sm font-semibold" style={{ color: 'var(--text-mid)' }}>
                        <Package className="inline w-4 h-4 mr-2" />
                        Variety
                      </Label>
                      <Input
                        id="variety"
                        type="text"
                        placeholder="e.g., Roma, Heirloom"
                        value={formData.variety}
                        onChange={e => handleInputChange('variety', e.target.value)}
                        className={`w-full border-2 rounded-xl px-4 py-3 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-green-pale hover:border-green-light ${errors.variety ? 'border-destructive bg-red-50 focus:border-destructive' : 'border-input focus:border-green-fresh bg-card'}`}
                        style={{ color: 'var(--text-dark)' }}
                      />
                      {errors.variety && <p className="text-destructive text-sm mt-2 flex items-center"><X className="w-4 h-4 mr-1" />{errors.variety}</p>}
                    </div>
                  </div>

                  {/* Outlier Notes */}
                  <div className="mb-8">
                    <Label htmlFor="outlierNotes" className="flex items-center mb-2 text-sm font-semibold" style={{ color: 'var(--text-mid)' }}>
                      <FileText className="inline w-4 h-4 mr-2" />
                      Notes/Observations
                    </Label>
                    <Textarea
                      id="outlierNotes"
                      placeholder="Describe any anomalies or interesting details about the sample."
                      value={formData.outlierNotes}
                      onChange={e => handleInputChange('outlierNotes', e.target.value)}
                      rows={4}
                      className={`w-full border-2 rounded-xl px-4 py-3 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-green-pale hover:border-green-light ${errors.outlierNotes ? 'border-destructive bg-red-50 focus:border-destructive' : 'border-input focus:border-green-fresh bg-card'}`}
                      style={{ color: 'var(--text-dark)' }}
                    />
                    {errors.outlierNotes && <p className="text-destructive text-sm mt-2 flex items-center"><X className="w-4 h-4 mr-1" />{errors.outlierNotes}</p>}
                  </div>
                </motion.div>

                {/* Image Upload Section */}
                <motion.div className="border-l-4 pl-5 sm:pl-8" style={{ borderColor: 'var(--green-pale)' }} {...staggerChild}>
                  <h3 className="text-xl font-display font-bold mb-8" style={{ color: 'var(--text-dark)' }}>Optional: Add Images</h3>
                  <div className="flex flex-col space-y-4">
                    <Label htmlFor="images" className="flex items-center text-sm font-semibold" style={{ color: 'var(--text-mid)' }}>
                      <Camera className="inline w-4 h-4 mr-2" />
                      Upload Photos (Max 3, up to 5MB each)
                    </Label>
                    <div className="flex flex-wrap items-center space-x-2 space-y-2">
                      {formData.images.map((file, index) => (
                        <div key={index} className="relative w-24 h-24 rounded-xl overflow-hidden border-2 group" style={{ borderColor: 'var(--green-pale)' }}>
                          <img src={URL.createObjectURL(file)} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {formData.images.length < 3 && (
                        <Label htmlFor="image-upload" className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer hover:border-green-fresh transition-colors" style={{ borderColor: 'var(--green-pale)', color: 'var(--text-muted)' }}>
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
                    {errors.images && <p className="text-destructive text-sm mt-2 flex items-center"><X className="w-4 h-4 mr-1" />{errors.images}</p>}
                  </div>
                </motion.div>

              </motion.form>
            </CardContent>
          </Card>
        </motion.div>
      </main>
      {/* Sticky footer submit button */}
      <div className="fixed bottom-0 left-0 right-0 border-t shadow-lg p-4" style={{ backgroundColor: 'var(--cream)', borderColor: 'var(--green-pale)', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 1rem))' }}>
      <div className="max-w-5xl mx-auto flex justify-end">
        <Button
          onClick={(e) => handleSubmit(e)}
          className="w-full sm:w-auto px-12 py-6 text-lg font-semibold rounded-xl hover:text-white"
          disabled={isLoading}
        >
         {isLoading ? (
          <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Submitting...
          </>
          ) : (
            'Submit Measurement'
          )}
        </Button>
        </div>
      </div>
    </div>
  );
};

export default DataEntry;
