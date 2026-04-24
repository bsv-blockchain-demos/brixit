import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

export type AppRole = 'admin' | 'contributor' | 'user';

export interface AdminResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface UserWithRoles {
  id: string;
  display_name: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  points: number | null;
  submission_count: number | null;
  created_at: string | null;
  roles: AppRole[];
}

export interface UnverifiedSubmission {
  id: string;
  assessment_date: string | null;
  brix_value: number;
  crop_name: string | null;
  crop_label: string | null;
  brand_name: string | null;
  brand_label: string | null;
  place_label: string | null;
  place_street_address: string | null;
  place_city: string | null;
  place_state: string | null;
  user_display_name: string | null;
  user_id: string;
}

export interface AdminSubmission extends UnverifiedSubmission {
  verified: boolean;
}

export interface AdminUserDetailSubmission {
  id: string;
  assessment_date: string;
  brix_value: number;
  verified: boolean;
  crop_name: string | null;
  crop_label: string | null;
  poor_brix: number | null;
  excellent_brix: number | null;
  brand_name: string | null;
  brand_label: string | null;
  place_label: string | null;
  place_street_address: string | null;
  place_city: string | null;
  place_state: string | null;
}

export interface AdminUserDetailData extends UserWithRoles {
  submissions: AdminUserDetailSubmission[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
}

export async function fetchAllUsers(params?: { search?: string; limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.offset !== undefined) qs.set('offset', String(params.offset));
  const query = qs.toString() ? `?${qs}` : '';
  return apiGet<PaginatedResult<UserWithRoles>>(`/api/admin/users${query}`);
}

export async function fetchUserDetail(userId: string) {
  return apiGet<AdminUserDetailData>(`/api/admin/users/${userId}`);
}

export async function fetchAllSubmissions(params?: { search?: string; verified?: boolean; limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.verified !== undefined) qs.set('verified', String(params.verified));
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.offset !== undefined) qs.set('offset', String(params.offset));
  const query = qs.toString() ? `?${qs}` : '';
  return apiGet<PaginatedResult<AdminSubmission>>(`/api/admin/submissions${query}`);
}

export async function fetchUnverifiedSubmissions(params?: { limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.offset !== undefined) qs.set('offset', String(params.offset));
  const query = qs.toString() ? `?${qs}` : '';
  return apiGet<PaginatedResult<UnverifiedSubmission>>(`/api/admin/submissions/unverified${query}`);
}

export async function grantRole(userId: string, role: Extract<AppRole, 'admin' | 'contributor'>) {
  return apiPost<AdminResponse>('/api/admin/roles/grant', {
    target_user_id: userId,
    role_to_grant: role,
  });
}

export async function revokeRole(userId: string, role: Extract<AppRole, 'admin' | 'contributor'>) {
  return apiPost<AdminResponse>('/api/admin/roles/revoke', {
    target_user_id: userId,
    role_to_revoke: role,
  });
}

// Helper function to upgrade user to contributor (from user)
export async function upgradeToContributor(userId: string) {
  return await grantRole(userId, 'contributor');
}

// Helper function to upgrade user to admin (from contributor or user)
export async function upgradeToAdmin(userId: string) {
  // Grant admin role, then revoke contributor if they have it
  const adminResult = await grantRole(userId, 'admin');
  if (adminResult.success) {
    // Try to revoke contributor (it's okay if it fails because they might not have it)
    try {
      await revokeRole(userId, 'contributor');
    } catch (e) {
      // Ignore error if they didn't have contributor role
    }
  }
  return adminResult;
}

// Helper function to downgrade admin to contributor
export async function downgradeToContributor(userId: string) {
  // Revoke admin, then grant contributor
  const revokeResult = await revokeRole(userId, 'admin');
  if (revokeResult.success) {
    return await grantRole(userId, 'contributor');
  }
  return revokeResult;
}

// Helper function to downgrade to regular user (remove all roles)
export async function downgradeToUser(userId: string) {
  // Revoke both admin and contributor
  const results = await Promise.allSettled([
    revokeRole(userId, 'admin'),
    revokeRole(userId, 'contributor'),
  ]);
  
  // Return success if at least one revocation succeeded
  const anySuccess = results.some(r => r.status === 'fulfilled' && r.value.success);
  return {
    success: anySuccess,
    message: 'User downgraded to regular user',
    error: anySuccess ? undefined : 'Failed to revoke roles'
  } as AdminResponse;
}

export async function verifySubmission(submissionId: string, verify = true) {
  return apiPost<AdminResponse>(`/api/admin/submissions/${submissionId}/verify`, { verify });
}

export async function deleteSubmission(submissionId: string) {
  await apiDelete(`/api/admin/submissions/${submissionId}`);
}

// CRUD Types

export interface AdminCrop {
  id: string;
  name: string;
  label: string | null;
  category: string | null;
  poor_brix: number | null;
  average_brix: number | null;
  good_brix: number | null;
  excellent_brix: number | null;
}

export interface AdminBrand {
  id: string;
  name: string;
  label: string | null;
}

export interface AdminCategory {
  id: string;
  name: string;
  label: string | null;
  sort_order: number;
}

// CRUD Helpers

function buildQs(p: { search?: string; limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (p.search) qs.set('search', p.search);
  if (p.limit !== undefined) qs.set('limit', String(p.limit));
  if (p.offset !== undefined) qs.set('offset', String(p.offset));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// Crops

export const fetchAdminCrops = (p: { search?: string; limit: number; offset: number }) =>
  apiGet<PaginatedResult<AdminCrop>>(`/api/admin/crud/crops${buildQs(p)}`);

export const createAdminCrop = (d: Partial<AdminCrop>) =>
  apiPost<AdminCrop>('/api/admin/crud/crops', d);

export const updateAdminCrop = (id: string, d: Partial<AdminCrop>) =>
  apiPut<AdminCrop>(`/api/admin/crud/crops/${id}`, d);

export const deleteAdminCrop = (id: string) =>
  apiDelete(`/api/admin/crud/crops/${id}`);

// Brands

export const fetchAdminBrands = (p: { search?: string; limit: number; offset: number }) =>
  apiGet<PaginatedResult<AdminBrand>>(`/api/admin/crud/brands${buildQs(p)}`);

export const createAdminBrand = (d: Partial<AdminBrand>) =>
  apiPost<AdminBrand>('/api/admin/crud/brands', d);

export const updateAdminBrand = (id: string, d: Partial<AdminBrand>) =>
  apiPut<AdminBrand>(`/api/admin/crud/brands/${id}`, d);

export const deleteAdminBrand = (id: string) =>
  apiDelete(`/api/admin/crud/brands/${id}`);

// Venues

export interface AdminVenue {
  id: string;
  name: string;
  posType: string | null;
  latitude: number | null;
  longitude: number | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  verified: boolean;
}

export const fetchAdminVenues = (p: { search?: string; limit: number; offset: number }) =>
  apiGet<PaginatedResult<AdminVenue>>(`/api/admin/crud/venues${buildQs(p)}`);

export const createAdminVenue = (d: Partial<AdminVenue>) =>
  apiPost<AdminVenue>('/api/admin/crud/venues', d);

export const updateAdminVenue = (id: string, d: Partial<AdminVenue>) =>
  apiPut<AdminVenue>(`/api/admin/crud/venues/${id}`, d);

export const deleteAdminVenue = (id: string) =>
  apiDelete(`/api/admin/crud/venues/${id}`);

// Categories

export const fetchAdminCategories = (p: { search?: string; limit: number; offset: number }) =>
  apiGet<PaginatedResult<AdminCategory>>(`/api/admin/crud/categories${buildQs(p)}`);

export const createAdminCategory = (d: Partial<AdminCategory>) =>
  apiPost<AdminCategory>('/api/admin/crud/categories', d);

export const updateAdminCategory = (id: string, d: Partial<AdminCategory>) =>
  apiPut<AdminCategory>(`/api/admin/crud/categories/${id}`, d);

export const deleteAdminCategory = (id: string) =>
  apiDelete(`/api/admin/crud/categories/${id}`);

