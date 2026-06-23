// Single source of truth for the fields a submission signs / anchors, and for
// how they are normalized. DataEntry (submit) and YourData (retry) both go
// through here so the signed payloads can't drift (e.g. brix rounding).

export interface SubmissionPayloadFields {
  cropName: string;
  brixValue: number;
  brandName?: string | null;
  notes?: string | null;
  assessmentDate: string;
  purchaseDate?: string | null;
  latitude: number | null;
  longitude: number | null;
  locationName?: string | null;
}

export function buildSubmissionPayload(f: SubmissionPayloadFields): Record<string, unknown> {
  return {
    cropName: f.cropName,
    brixValue: Number(f.brixValue.toFixed(2)),
    brandName: f.brandName || null,
    notes: f.notes || null,
    assessmentDate: f.assessmentDate,
    purchaseDate: f.purchaseDate || null,
    latitude: f.latitude,
    longitude: f.longitude,
    locationName: f.locationName || null,
  };
}
