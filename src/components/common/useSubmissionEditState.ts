/**
 * Edit-form state for a submission, plus the name-to-id resolution the update
 * endpoint expects. Shared by the detail modal and the resubmit view.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BrixDataPoint } from '../../types';

export interface SubmissionEditValues {
  brixLevel: number | '';
  cropType: string;
  variety: string;
  brand: string;
  locationName: string;
  measurementDate: string;
  purchaseDate: string;
  outlierNotes: string;
}

export interface NamedItem { id: string; name: string; label?: string }

const toDateInput = (v: string | null | undefined): string => (v ? String(v).slice(0, 10) : '');

export function useSubmissionEditState(dataPoint: BrixDataPoint | null) {
  const [brixLevel, setBrixLevel] = useState<number | ''>('');
  const [cropType, setCropType] = useState('');
  const [variety, setVariety] = useState('');
  const [brand, setBrand] = useState('');
  const [locationName, setLocationName] = useState('');
  const [measurementDate, setMeasurementDate] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [outlierNotes, setOutlierNotes] = useState('');

  // The normalised values a fresh form should start from, or null when there's
  // nothing to edit yet. Single source of truth for both `reset` and `isDirty`.
  const pristine = useMemo((): SubmissionEditValues | null => {
    if (!dataPoint) return null;
    return {
      brixLevel: dataPoint.brixLevel ?? '',
      cropType: dataPoint.cropType ?? '',
      variety: dataPoint.variety ?? '',
      brand: dataPoint.brandName ?? '',
      locationName: dataPoint.locationName ?? '',
      measurementDate: toDateInput(dataPoint.submittedAt),
      purchaseDate: toDateInput(dataPoint.purchaseDate),
      outlierNotes: dataPoint.outlier_notes ?? '',
    };
  }, [dataPoint]);

  const reset = useCallback(() => {
    if (!pristine) return;
    setBrixLevel(pristine.brixLevel);
    setCropType(pristine.cropType);
    setVariety(pristine.variety);
    setBrand(pristine.brand);
    setLocationName(pristine.locationName);
    setMeasurementDate(pristine.measurementDate);
    setPurchaseDate(pristine.purchaseDate);
    setOutlierNotes(pristine.outlierNotes);
  }, [pristine]);

  useEffect(() => { reset(); }, [reset]);

  const values = { brixLevel, cropType, variety, brand, locationName, measurementDate, purchaseDate, outlierNotes };

  // False whenever there's no pristine baseline yet, so a not-yet-loaded form
  // can never be reported as changed.
  const isDirty = useMemo(
    () => !!pristine && (Object.keys(pristine) as (keyof SubmissionEditValues)[]).some((k) => values[k] !== pristine[k]),
    [values, pristine],
  );

  return {
    values,
    setters: { setBrixLevel, setCropType, setVariety, setBrand, setLocationName, setMeasurementDate, setPurchaseDate, setOutlierNotes },
    reset,
    isDirty,
  };
}

export type SubmissionEditState = ReturnType<typeof useSubmissionEditState>;

// A blank BRIX input falls back to the stored reading rather than clearing it.
export const normalizeBrix = (val: number | ''): number | null => {
  if (val === '') return null;
  const n = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(n) ? n : null;
};

// Widens a YYYY-MM-DD input to an ISO timestamp, falling back to the stored value.
export const toISODateOrExisting = (dateStr: string, existingISO: string) => {
  if (!dateStr) return existingISO;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? existingISO : d.toISOString();
};

/**
 * Builds the `PUT /api/submissions/:id` body. Keys are ids, not names, so crop,
 * brand and store are resolved against the static lists; a value matching
 * nothing returns an error for the caller to surface.
 */
export function buildSubmissionUpdate(args: {
  values: SubmissionEditValues;
  dataPoint: BrixDataPoint;
  crops: NamedItem[];
  brands: NamedItem[];
  locations: NamedItem[];
}): { body: Record<string, any> } | { error: string; errorTitle: string } {
  const { values, dataPoint, crops, brands, locations } = args;
  const { brixLevel, cropType, variety, brand, locationName, measurementDate, purchaseDate, outlierNotes } = values;

  const newBrix = normalizeBrix(brixLevel);
  const brixToSave = newBrix ?? dataPoint.brixLevel;

  const safecrops = Array.isArray(crops) ? crops : [];
  const safebrands = Array.isArray(brands) ? brands : [];
  const safelocations = Array.isArray(locations) ? locations : [];

  // Resolve IDs only when values changed; crop is required if changed
  let cropIdToSet: string | undefined;
  let brandIdToSet: string | null | undefined;
  let locationIdToSet: string | null | undefined;

  if (cropType !== dataPoint.cropType) {
    const cropItem = safecrops.find(c => c?.name === cropType);
    if (!cropItem?.id) {
      return { errorTitle: 'Invalid crop', error: 'Please select a valid crop from the list.' };
    }
    cropIdToSet = cropItem.id;
  }

  if (brand !== dataPoint.brandName) {
    if (!brand) {
      brandIdToSet = null; // allow clearing brand
    } else {
      const brandItem = safebrands.find(b => b?.name === brand);
      if (!brandItem?.id) {
        return { errorTitle: 'Invalid brand', error: 'Please select a valid brand from the list or clear the field.' };
      }
      brandIdToSet = brandItem.id;
    }
  }

  if (locationName !== dataPoint.locationName) {
    if (!locationName) {
      locationIdToSet = null;
    } else {
      const locationItem = safelocations.find(s => s?.name === locationName);
      if (!locationItem?.id) {
        return { errorTitle: 'Invalid location', error: 'Please select a valid location from the list or clear the field.' };
      }
      locationIdToSet = locationItem.id;
    }
  }

  // Build update payload (only include fields that can change)
  const body: Record<string, any> = {
    brix_value: brixToSave,
    crop_variety: variety || null,
    assessment_date: toISODateOrExisting(measurementDate, dataPoint.submittedAt),
    purchase_date: purchaseDate || null,
    outlier_notes: outlierNotes || null,
  };

  if (typeof cropIdToSet === 'string') body.crop_id = cropIdToSet;
  if (brandIdToSet !== undefined) body.brand_id = brandIdToSet;
  // Backend stores locations in the venues table — wire `location_id`
  // selections to the PUT body's `venue_id`.
  if (locationIdToSet !== undefined) body.venue_id = locationIdToSet;

  return { body };
}
