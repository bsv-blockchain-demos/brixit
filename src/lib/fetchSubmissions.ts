// src/lib/fetchSubmissions.ts
import { apiGet, apiDelete } from '@/lib/api';
import { BrixDataPoint } from '@/types';

// Backend API row shape (matches Express route response)
interface ApiSubmissionRow {
  id: string;
  assessment_date: string;
  brix_value: number;
  verified: boolean;
  verified_at: string | null;
  crop_variety: string | null;
  outlier_notes: string | null;
  purchase_date: string | null;
  crop_id: string | null;
  crop_name: string | null;
  crop_label: string | null;
  poor_brix: number | null;
  average_brix: number | null;
  good_brix: number | null;
  excellent_brix: number | null;
  category: string | null;
  brand_id: string | null;
  brand_name: string | null;
  brand_label: string | null;
  location_id: string | null;
  location_name: string | null;
  location_label: string | null;
  place_id: string | null;
  place_label: string | null;
  latitude: number | null;
  longitude: number | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  user_id?: string | null;
  user_display_name?: string | null;
  verified_by_display_name?: string | null;
  images?: string[];
}

function formatApiRow(r: ApiSubmissionRow): BrixDataPoint {
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
    submittedBy: r.user_display_name ?? '',
    userId: r.user_id ?? undefined,
    verifiedBy: r.verified_by_display_name ?? '',
    submittedAt: r.assessment_date,
    outlier_notes: r.outlier_notes ?? '',
    purchaseDate: r.purchase_date ?? null,
    images: r.images ?? [],
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

export async function fetchMySubmissions(userId: string): Promise<BrixDataPoint[]> {
  try {
    const rows = await apiGet<ApiSubmissionRow[]>('/api/submissions/mine');
    return rows.map(formatApiRow);
  } catch (error) {
    console.error('Error fetching user submissions:', error);
    return [];
  }
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
    limit,
    offset,
    sortBy = 'assessment_date',
    sortOrder = 'desc',
  } = query;

  const params = new URLSearchParams({
    limit: String(Math.max(1, Math.min(limit, 200))),
    offset: String(Math.max(0, offset)),
    sortBy,
    sortOrder,
  });

  try {
    const rows = await apiGet<ApiSubmissionRow[]>(`/api/submissions/mine?${params}`);
    return rows.map(formatApiRow);
  } catch (error) {
    console.error('Error fetching user submissions page:', error);
    return [];
  }
}

export async function fetchMySubmissionsCount(
  query: MySubmissionsCountQuery
): Promise<number> {
  const { verified } = query;
  const params = new URLSearchParams();
  if (typeof verified === 'boolean') params.set('verified', String(verified));

  try {
    const data = await apiGet<{ count: number }>(`/api/submissions/mine/count?${params}`);
    return data.count;
  } catch (error) {
    console.error('Error fetching user submissions count:', error);
    return 0;
  }
}

export async function fetchMySubmissionsCropIds(userId: string): Promise<string[]> {
  try {
    return await apiGet<string[]>('/api/submissions/mine/crops');
  } catch (error) {
    console.error('Error fetching user crop ids:', error);
    return [];
  }
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

function buildSubmissionsQueryString(query: Partial<PublicFormattedSubmissionsQuery>): string {
  const params = new URLSearchParams();
  if (query.limit) params.set('limit', String(query.limit));
  if (query.offset) params.set('offset', String(query.offset));
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);
  if (query.cropTypes && query.cropTypes.length > 0) params.set('cropTypes', query.cropTypes.join(','));
  if (query.category) params.set('category', query.category);
  if (query.city) params.set('city', query.city);
  if (query.state) params.set('state', query.state);
  if (query.country) params.set('country', query.country);
  if (typeof query.brixMin === 'number') params.set('brixMin', String(query.brixMin));
  if (typeof query.brixMax === 'number') params.set('brixMax', String(query.brixMax));
  if (query.dateStart) params.set('dateStart', query.dateStart);
  if (query.dateEnd) params.set('dateEnd', query.dateEnd);
  if (query.search) params.set('search', query.search);
  return params.toString();
}

export async function fetchFormattedSubmissionsPage(
  query: PublicFormattedSubmissionsQuery
): Promise<BrixDataPoint[]> {
  try {
    const qs = buildSubmissionsQueryString(query);
    const rows = await apiGet<ApiSubmissionRow[]>(`/api/submissions?${qs}`, { skipAuth: true });
    return rows.map(formatApiRow);
  } catch (error) {
    console.error('Error fetching public submissions page:', error);
    return [];
  }
}

export async function fetchFormattedSubmissionsInBounds(
  query: PublicFormattedSubmissionsBoundsQuery
): Promise<BrixDataPoint[]> {
  try {
    const params = new URLSearchParams({
      west: String(query.west),
      south: String(query.south),
      east: String(query.east),
      north: String(query.north),
      limit: String(query.limit),
    });
    if (query.sortBy) params.set('sortBy', query.sortBy);
    if (query.sortOrder) params.set('sortOrder', query.sortOrder);

    const rows = await apiGet<ApiSubmissionRow[]>(`/api/submissions/bounds?${params}`, { skipAuth: true });
    return rows.map(formatApiRow);
  } catch (error) {
    console.error('Error fetching public submissions in bounds:', error);
    return [];
  }
}

export async function fetchFormattedSubmissionById(id: string): Promise<BrixDataPoint | null> {
  const safeId = (id ?? '').toString().trim();
  if (!safeId) return null;

  try {
    const row = await apiGet<ApiSubmissionRow>(`/api/submissions/${safeId}`, { skipAuth: true });
    return formatApiRow(row);
  } catch (error) {
    console.error('Error fetching public submission by id:', error);
    return null;
  }
}

export async function fetchFormattedSubmissionsCount(
  query: Omit<PublicFormattedSubmissionsQuery, 'limit' | 'offset'>
): Promise<number> {
  try {
    const { sortBy: _sortBy, sortOrder: _sortOrder, ...rest } = query;
    const qs = buildSubmissionsQueryString(rest);
    const data = await apiGet<{ count: number }>(`/api/submissions/count?${qs}`, { skipAuth: true });
    return data.count;
  } catch (error) {
    console.error('Error fetching public submissions count:', error);
    return 0;
  }
}

// SAFE public fetch for the map
export async function fetchFormattedSubmissions(): Promise<BrixDataPoint[]> {
  try {
    const rows = await apiGet<ApiSubmissionRow[]>('/api/submissions?limit=200', { skipAuth: true });
    return rows.map(formatApiRow);
  } catch (error) {
    console.error('Error fetching public submissions:', error);
    return [];
  }
}

// Authenticated details (owner/admin)
export async function fetchSubmissionById(id: string): Promise<BrixDataPoint | null> {
  try {
    const row = await apiGet<ApiSubmissionRow>(`/api/submissions/${id}`);
    return formatApiRow(row);
  } catch (error) {
    console.error('Error fetching submission by id:', error);
    return null;
  }
}

export async function deleteSubmission(submissionId: string): Promise<boolean> {
  try {
    await apiDelete(`/api/submissions/${submissionId}`);
    return true;
  } catch (error) {
    console.error('Error deleting submission:', error);
    return false;
  }
}
