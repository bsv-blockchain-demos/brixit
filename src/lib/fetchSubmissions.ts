// src/lib/fetchSubmissions.ts
import { supabase } from '@/integrations/supabase/client';
import { BrixDataPoint } from '@/types';

// Full-join query for authenticated contexts (owner/admin views)
const SUBMISSIONS_SELECT_QUERY_STRING = `
  id,
  assessment_date,
  brix_value,
  verified,
  verified_at,
  crop_variety,
  outlier_notes,
  purchase_date,
  place:place_id(id,label,latitude,longitude,street_address,city,state,country),
  location:location_id(id,name,label),
  brand:brand_id(id,name,label),
  user:users!user_id(id,display_name),
  verifier:users!verified_by(id,display_name),
  submission_images(image_url),
  crop:crop_id(id,name,label,poor_brix,average_brix,good_brix,excellent_brix,category)
`;

interface SupabaseSubmissionRow {
  id: string;
  assessment_date: string;
  brix_value: number;
  verified: boolean;
  verified_at: string | null;
  crop_variety: string | null;
  outlier_notes: string | null;
  purchase_date: string | null;
  place: {
    id: string;
    label: string;
    latitude: number | null;
    longitude: number | null;
    street_address?: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  } | null;
  location: {
    id: string;
    name: string;
    label: string | null;
  } | null;
  brand: {
    id: string;
    name: string;
    label: string | null;
  } | null;
  user: {
    id: string;
    display_name: string;
  } | null;
  verifier: {
    id: string;
    display_name: string;
  } | null;
  submission_images: {
    image_url: string;
  }[];
  crop: {
    id: string;
    name: string;
    label: string | null;
    poor_brix: number | null;
    average_brix: number | null;
    good_brix: number | null;
    excellent_brix: number | null;
    category: string | null;
  } | null;
}

function formatSubmissionData(item: SupabaseSubmissionRow): BrixDataPoint {
  return {
    id: item.id,
    brixLevel: item.brix_value,
    verified: item.verified,
    verifiedAt: item.verified_at,
    variety: item.crop_variety ?? '',
    cropType: item.crop?.name ?? 'Unknown',
    category: item.crop?.category ?? '',
    latitude: item.place?.latitude ?? null,
    longitude: item.place?.longitude ?? null,
    placeName: item.place?.label ?? '',
    locationName: item.location?.label ?? item.location?.name ?? '',
    streetAddress: item.place?.street_address ?? '',
    city: item.place?.city ?? '',
    state: item.place?.state ?? '',
    country: item.place?.country ?? '',
    brandName: item.brand?.label ?? item.brand?.name ?? '',
    submittedBy: item.user?.display_name ?? '',
    userId: item.user?.id ?? undefined,
    verifiedBy: item.verifier?.display_name ?? '',
    submittedAt: item.assessment_date,
    outlier_notes: item.outlier_notes ?? '',
    purchaseDate: item.purchase_date,
    images: item.submission_images?.map((img) => img.image_url) ?? [],
    poorBrix: item.crop?.poor_brix ?? null,
    averageBrix: item.crop?.average_brix ?? null,
    goodBrix: item.crop?.good_brix ?? null,
    excellentBrix: item.crop?.excellent_brix ?? null,
    name_normalized: item.crop?.label ?? item.crop?.name ?? 'Unknown',
    locationId: item.location?.id ?? '',
    cropId: item.crop?.id ?? '',
    placeId: item.place?.id ?? '',
    brandId: item.brand?.id ?? '',
    verifiedByUserId: item.verifier?.id ?? '',
    cropLabel: item.crop?.label ?? null,
    brandLabel: item.brand?.label ?? null,
  };
}

export async function fetchMySubmissions(userId: string): Promise<BrixDataPoint[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select(SUBMISSIONS_SELECT_QUERY_STRING)
    .eq('user_id', userId)
    .order('assessment_date', { ascending: false });

  if (error) {
    console.error('Error fetching user submissions:', error);
    return [];
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => formatSubmissionData(row as SupabaseSubmissionRow));
}

export type MySubmissionsPageQuery = {
  userId: string;
  limit: number;
  offset: number;
  sortBy?: 'assessment_date' | 'brix_value';
  sortOrder?: 'asc' | 'desc';
};

export type MySubmissionsCountQuery = {
  userId: string;
  verified?: boolean;
};

export async function fetchMySubmissionsPage(
  query: MySubmissionsPageQuery
): Promise<BrixDataPoint[]> {
  const {
    userId,
    limit,
    offset,
    sortBy = 'assessment_date',
    sortOrder = 'desc',
  } = query;

  const safeLimit = Math.max(1, Math.min(limit, 200));
  const safeOffset = Math.max(0, offset);

  const { data, error } = await supabase
    .from('submissions')
    .select(SUBMISSIONS_SELECT_QUERY_STRING)
    .eq('user_id', userId)
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(safeOffset, safeOffset + safeLimit - 1);

  if (error) {
    console.error('Error fetching user submissions page:', error);
    return [];
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => formatSubmissionData(row as SupabaseSubmissionRow));
}

export async function fetchMySubmissionsCount(
  query: MySubmissionsCountQuery
): Promise<number> {
  const { userId, verified } = query;

  let base = supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (typeof verified === 'boolean') {
    base = base.eq('verified', verified);
  }

  const { count, error } = await base;
  if (error) {
    console.error('Error fetching user submissions count:', error);
    return 0;
  }
  return typeof count === 'number' ? count : 0;
}

export async function fetchMySubmissionsCropIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('crop_id')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user crop ids:', error);
    return [];
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((r: any) => r?.crop_id).filter(Boolean);
}

export type PublicFormattedSubmissionsQuery = {
  limit: number;
  offset: number;
  cropTypes?: string[];
  category?: string;
  brand?: string;
  place?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  brixMin?: number;
  brixMax?: number;
  dateStart?: string;
  dateEnd?: string;
  search?: string;
  sortBy?: 'assessment_date' | 'brix_value' | 'crop_name' | 'place_label';
  sortOrder?: 'asc' | 'desc';
};

 export type PublicFormattedSubmissionsBoundsQuery = {
  west: number;
  south: number;
  east: number;
  north: number;
  limit: number;
  sortBy?: 'assessment_date' | 'brix_value' | 'crop_name' | 'place_label';
  sortOrder?: 'asc' | 'desc';
 };

function applyPublicFormattedSubmissionsQuery(
  base: any,
  q: Omit<PublicFormattedSubmissionsQuery, 'limit' | 'offset'>
) {
  if (q.cropTypes && q.cropTypes.length > 0) {
    base = base.in('crop_name', q.cropTypes);
  }
  if (q.category && q.category.trim().length > 0) {
    base = base.eq('category', q.category);
  }
  if (q.city && q.city.trim().length > 0) {
    base = base.ilike('city', q.city);
  }
  if (q.state && q.state.trim().length > 0) {
    base = base.ilike('state', q.state);
  }
  if (q.country && q.country.trim().length > 0) {
    base = base.ilike('country', q.country);
  }
  if (typeof q.brixMin === 'number') {
    base = base.gte('brix_value', q.brixMin);
  }
  if (typeof q.brixMax === 'number') {
    base = base.lte('brix_value', q.brixMax);
  }
  if (q.dateStart && q.dateStart.trim().length > 0) {
    base = base.gte('assessment_date', q.dateStart);
  }
  if (q.dateEnd && q.dateEnd.trim().length > 0) {
    base = base.lte('assessment_date', q.dateEnd);
  }

  const brand = q.brand?.trim();
  if (brand) {
    const s = brand.replace(/,/g, '');
    base = base.or(`brand_label.ilike.%${s}%,brand_name.ilike.%${s}%`);
  }

  const placeOrLocation = (q.place || q.location)?.trim();
  if (placeOrLocation) {
    const s = placeOrLocation.replace(/,/g, '');
    base = base.or(`place_label.ilike.%${s}%,location_label.ilike.%${s}%,location_name.ilike.%${s}%`);
  }

  const search = q.search?.trim();
  if (search) {
    const s = search.replace(/,/g, '');
    base = base.or(
      `crop_name.ilike.%${s}%,crop_label.ilike.%${s}%,brand_label.ilike.%${s}%,brand_name.ilike.%${s}%,place_label.ilike.%${s}%,location_label.ilike.%${s}%,location_name.ilike.%${s}%,outlier_notes.ilike.%${s}%`
    );
  }

  return base;
}

function formatPublicSubmissionDetailsRow(r: any): BrixDataPoint {
  return {
    id: r.id,
    brixLevel: r.brix_value,
    verified: !!r.verified,
    verifiedAt: r.verified_at ?? null,
    variety: r.crop_variety ?? '',
    cropType: r.crop_name ?? 'Unknown',
    category: r.category ?? '',
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    placeName: r.place_label ?? '',
    locationName: r.location_label ?? r.location_name ?? '',
    streetAddress: r.street_address ?? '',
    city: r.city ?? '',
    state: r.state ?? '',
    country: r.country ?? '',
    brandName: r.brand_label ?? r.brand_name ?? '',
    submittedBy: '',
    userId: undefined,
    verifiedBy: '',
    submittedAt: r.assessment_date,
    outlier_notes: r.outlier_notes ?? '',
    purchaseDate: r.purchase_date ?? null,
    images: [],
    poorBrix: r.poor_brix ?? null,
    averageBrix: r.average_brix ?? null,
    goodBrix: r.good_brix ?? null,
    excellentBrix: r.excellent_brix ?? null,
    name_normalized: r.crop_label ?? r.crop_name ?? 'Unknown',
    locationId: r.location_id ?? '',
    cropId: r.crop_id ?? '',
    placeId: r.place_id ?? '',
    brandId: r.brand_id ?? '',
    verifiedByUserId: '',
    cropLabel: r.crop_label ?? null,
    brandLabel: r.brand_label ?? null,
  };
}

export async function fetchFormattedSubmissionsPage(
  query: PublicFormattedSubmissionsQuery
): Promise<BrixDataPoint[]> {
  const {
    limit,
    offset,
    sortBy = 'assessment_date',
    sortOrder = 'desc',
    ...rest
  } = query;

  const safeLimit = Math.max(1, Math.min(limit, 200));
  const safeOffset = Math.max(0, offset);

  const selectCols = [
    'id',
    'assessment_date',
    'brix_value',
    'verified',
    'verified_at',
    'crop_variety',
    'outlier_notes',
    'purchase_date',
    'crop_id',
    'crop_name',
    'crop_label',
    'poor_brix',
    'average_brix',
    'good_brix',
    'excellent_brix',
    'category',
    'brand_id',
    'brand_name',
    'brand_label',
    'location_id',
    'location_name',
    'location_label',
    'place_id',
    'place_label',
    'latitude',
    'longitude',
    'street_address',
    'city',
    'state',
    'country',
  ].join(',');

  let base = (supabase as any)
    .from('public_submission_details' as any)
    .select(selectCols)
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(safeOffset, safeOffset + safeLimit - 1);

  base = applyPublicFormattedSubmissionsQuery(base, rest);

  const { data, error } = await base;

  if (error) {
    console.error('Error fetching public submissions page:', error);
    return [];
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map(formatPublicSubmissionDetailsRow);
}

export async function fetchFormattedSubmissionsInBounds(
  query: PublicFormattedSubmissionsBoundsQuery
): Promise<BrixDataPoint[]> {
  const {
    west,
    south,
    east,
    north,
    limit,
    sortBy = 'assessment_date',
    sortOrder = 'desc',
  } = query;

  const safeLimit = Math.max(1, Math.min(limit, 2000));

  const selectCols = [
    'id',
    'assessment_date',
    'brix_value',
    'verified',
    'verified_at',
    'crop_variety',
    'outlier_notes',
    'purchase_date',
    'crop_id',
    'crop_name',
    'crop_label',
    'poor_brix',
    'average_brix',
    'good_brix',
    'excellent_brix',
    'category',
    'brand_id',
    'brand_name',
    'brand_label',
    'location_id',
    'location_name',
    'location_label',
    'place_id',
    'place_label',
    'latitude',
    'longitude',
    'street_address',
    'city',
    'state',
    'country',
  ].join(',');

  const { data, error } = await (supabase as any)
    .from('public_submission_details' as any)
    .select(selectCols)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .gte('longitude', west)
    .lte('longitude', east)
    .gte('latitude', south)
    .lte('latitude', north)
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(0, safeLimit - 1);

  if (error) {
    console.error('Error fetching public submissions in bounds:', error);
    return [];
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map(formatPublicSubmissionDetailsRow);
}

export async function fetchFormattedSubmissionById(id: string): Promise<BrixDataPoint | null> {
  const safeId = (id ?? '').toString().trim();
  if (!safeId) return null;

  const selectCols = [
    'id',
    'assessment_date',
    'brix_value',
    'verified',
    'verified_at',
    'crop_variety',
    'outlier_notes',
    'purchase_date',
    'crop_id',
    'crop_name',
    'crop_label',
    'poor_brix',
    'average_brix',
    'good_brix',
    'excellent_brix',
    'category',
    'brand_id',
    'brand_name',
    'brand_label',
    'location_id',
    'location_name',
    'location_label',
    'place_id',
    'place_label',
    'latitude',
    'longitude',
    'street_address',
    'city',
    'state',
    'country',
  ].join(',');

  const { data, error } = await (supabase as any)
    .from('public_submission_details' as any)
    .select(selectCols)
    .eq('id', safeId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching public submission by id:', error);
    return null;
  }

  if (!data) return null;
  return formatPublicSubmissionDetailsRow(data);
}

export async function fetchFormattedSubmissionsCount(
  query: Omit<PublicFormattedSubmissionsQuery, 'limit' | 'offset'>
): Promise<number> {
  const { sortBy: _sortBy, sortOrder: _sortOrder, ...rest } = query;

  let base = (supabase as any)
    .from('public_submission_details' as any)
    .select('id', { count: 'exact', head: true });

  base = applyPublicFormattedSubmissionsQuery(base, rest);

  const { count, error } = await base;
  if (error) {
    console.error('Error fetching public submissions count:', error);
    return 0;
  }
  return typeof count === 'number' ? count : 0;
}

// SAFE public fetch for the map: reads from the view and rehydrates labels/coords client-side
export async function fetchFormattedSubmissions(): Promise<BrixDataPoint[]> {
  // Prefer a single joined public view if present (reduces DB calls drastically).
  try {
    const { data: joinedRows, error: joinedErr } = await (supabase as any)
      .from('public_submission_details' as any)
      .select('*')
      .order('assessment_date', { ascending: false });

    if (!joinedErr && Array.isArray(joinedRows)) {
      return joinedRows.map(formatPublicSubmissionDetailsRow);
    }
  } catch {
    // fall through to legacy multi-query path
  }

  // 1) Get safe rows (no PII) from public view
  const { data: rows, error } = await supabase
    .from('public_submissions')
    .select(`
      id,
      assessment_date,
      brix_value,
      verified,
      verified_at,
      crop_variety,
      outlier_notes,
      purchase_date,
      crop_id,
      brand_id,
      location_id,
      place_id
    `)
    .order('assessment_date', { ascending: false });

  if (error) {
    console.error('Error fetching public submissions:', error);
    return [];
  }

  const submissions = Array.isArray(rows) ? rows : [];

  // 2) Collect IDs for batch fetches
  const cropIds = Array.from(new Set(submissions.map((s: any) => s.crop_id).filter(Boolean)));
  const brandIds = Array.from(new Set(submissions.map((s: any) => s.brand_id).filter(Boolean)));
  const locationIds = Array.from(new Set(submissions.map((s: any) => s.location_id).filter(Boolean)));
  const placeIds = Array.from(new Set(submissions.map((s: any) => s.place_id).filter(Boolean)));

  // 3) Batch fetch dictionaries (guard against empty arrays)
  const [
    cropsRes,
    brandsRes,
    locationsRes,
    placesRes,
  ] = await Promise.all([
    cropIds.length
      ? supabase.from('crops').select('id,name,label,poor_brix,average_brix,good_brix,excellent_brix,category').in('id', cropIds)
      : Promise.resolve({ data: [], error: null }),
    brandIds.length
      ? supabase.from('brands').select('id,name,label').in('id', brandIds)
      : Promise.resolve({ data: [], error: null }),
    locationIds.length
      ? supabase.from('locations').select('id,name,label').in('id', locationIds)
      : Promise.resolve({ data: [], error: null }),
    placeIds.length
      ? supabase.from('places').select('id,label,latitude,longitude,street_address,city,state,country').in('id', placeIds)
      : Promise.resolve({ data: [], error: null }),
  ] as const);

  if (cropsRes.error) console.warn('crops fetch warning:', cropsRes.error.message);
  if (brandsRes.error) console.warn('brands fetch warning:', brandsRes.error.message);
  if (locationsRes.error) console.warn('locations fetch warning:', locationsRes.error.message);
  if (placesRes.error) console.warn('places fetch warning:', placesRes.error.message);

  const cropsById = new Map((cropsRes.data || []).map((c: any) => [c.id, c]));
  const brandsById = new Map((brandsRes.data || []).map((b: any) => [b.id, b]));
  const locationsById = new Map((locationsRes.data || []).map((l: any) => [l.id, l]));
  const placesById = new Map((placesRes.data || []).map((p: any) => [p.id, p]));

  // 4) Rehydrate to BrixDataPoint
  const result: BrixDataPoint[] = submissions.map((s: any) => {
    const crop = cropsById.get(s.crop_id);
    const brand = brandsById.get(s.brand_id);
    const location = locationsById.get(s.location_id);
    const place = placesById.get(s.place_id);

    return {
      id: s.id,
      brixLevel: s.brix_value,
      verified: !!s.verified,
      verifiedAt: s.verified_at ?? null,
      variety: s.crop_variety ?? '',
      cropType: crop?.name ?? 'Unknown',
      category: crop?.category ?? '',
      latitude: place?.latitude ?? null,
      longitude: place?.longitude ?? null,
      placeName: place?.label ?? '',
      locationName: location?.label ?? location?.name ?? '',
      streetAddress: place?.street_address ?? '',
      city: place?.city ?? '',
      state: place?.state ?? '',
      country: place?.country ?? '',
      brandName: brand?.label ?? brand?.name ?? '',
      // PII removed in public view
      submittedBy: '',
      userId: undefined,
      verifiedBy: '',
      submittedAt: s.assessment_date,
      outlier_notes: s.outlier_notes ?? '',
      purchaseDate: s.purchase_date ?? null,
      images: [], // Images are intentionally omitted in the public view
      poorBrix: crop?.poor_brix ?? null,
      averageBrix: crop?.average_brix ?? null,
      goodBrix: crop?.good_brix ?? null,
      excellentBrix: crop?.excellent_brix ?? null,
      name_normalized: crop?.label ?? crop?.name ?? 'Unknown',
      locationId: s.location_id ?? '',
      cropId: s.crop_id ?? '',
      placeId: s.place_id ?? '',
      brandId: s.brand_id ?? '',
      verifiedByUserId: '',
      cropLabel: crop?.label ?? null,
      brandLabel: brand?.label ?? null,
    };
  });

  return result;
}

// Authenticated details (owner/admin) with join; public fallback to the safe view + dictionaries
export async function fetchSubmissionById(id: string): Promise<BrixDataPoint | null> {
  // Attempt full join (requires appropriate RLS)
  const { data, error } = await supabase
    .from('submissions')
    .select(SUBMISSIONS_SELECT_QUERY_STRING)
    .eq('id', id)
    .maybeSingle();

  if (!error && data) {
    return formatSubmissionData(data as SupabaseSubmissionRow);
  }

  // Fallback: use public view + dictionaries (no PII)
  const { data: pub, error: pubErr } = await supabase
    .from('public_submissions')
    .select('id, assessment_date, brix_value, verified, verified_at, crop_variety, outlier_notes, purchase_date, crop_id, brand_id, location_id, place_id')
    .eq('id', id)
    .maybeSingle();

  if (pubErr || !pub) {
    if (pubErr) console.error('Error fetching public submission by id:', pubErr);
    return null;
  }

  // Fetch the related records for this submission
  const [cropRes, brandRes, locationRes, placeRes] = await Promise.all([
    pub.crop_id ? supabase.from('crops').select('id,name,label,poor_brix,average_brix,good_brix,excellent_brix,category').eq('id', pub.crop_id).maybeSingle() : Promise.resolve({ data: null }),
    pub.brand_id ? supabase.from('brands').select('id,name,label').eq('id', pub.brand_id).maybeSingle() : Promise.resolve({ data: null }),
    pub.location_id ? supabase.from('locations').select('id,name,label').eq('id', pub.location_id).maybeSingle() : Promise.resolve({ data: null }),
    pub.place_id ? supabase.from('places').select('id,label,latitude,longitude,street_address,city,state,country').eq('id', pub.place_id).maybeSingle() : Promise.resolve({ data: null }),
  ] as const);

  const crop = (cropRes as any)?.data || null;
  const brand = (brandRes as any)?.data || null;
  const location = (locationRes as any)?.data || null;
  const place = (placeRes as any)?.data || null;

  const single: BrixDataPoint = {
    id: pub.id,
    brixLevel: pub.brix_value,
    verified: !!pub.verified,
    verifiedAt: pub.verified_at ?? null,
    variety: pub.crop_variety ?? '',
    cropType: crop?.name ?? 'Unknown',
    category: crop?.category ?? '',
    latitude: place?.latitude ?? null,
    longitude: place?.longitude ?? null,
    placeName: place?.label ?? '',
    locationName: location?.label ?? location?.name ?? '',
    streetAddress: place?.street_address ?? '',
    city: place?.city ?? '',
    state: place?.state ?? '',
    country: place?.country ?? '',
    brandName: brand?.label ?? brand?.name ?? '',
    submittedBy: '',
    userId: undefined,
    verifiedBy: '',
    submittedAt: pub.assessment_date,
    outlier_notes: pub.outlier_notes ?? '',
    purchaseDate: pub.purchase_date ?? null,
    images: [],
    poorBrix: crop?.poor_brix ?? null,
    averageBrix: crop?.average_brix ?? null,
    goodBrix: crop?.good_brix ?? null,
    excellentBrix: crop?.excellent_brix ?? null,
    name_normalized: crop?.label ?? crop?.name ?? 'Unknown',
    locationId: pub.location_id ?? '',
    cropId: pub.crop_id ?? '',
    placeId: pub.place_id ?? '',
    brandId: pub.brand_id ?? '',
    verifiedByUserId: '',
    cropLabel: crop?.label ?? null,
    brandLabel: brand?.label ?? null,
  };

  return single;
}

export async function deleteSubmission(submissionId: string): Promise<boolean> {
  try {
    const { error: deleteImagesError } = await supabase
      .from('submission_images')
      .delete()
      .eq('submission_id', submissionId);
    if (deleteImagesError) console.error('Error deleting submission image metadata:', deleteImagesError);

    const { error: deleteSubmissionError } = await supabase
      .from('submissions')
      .delete()
      .eq('id', submissionId);
    if (deleteSubmissionError) {
      console.error('Error deleting submission:', deleteSubmissionError);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Unhandled error during submission deletion:', error);
    return false;
  }
}
