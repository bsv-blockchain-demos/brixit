import { apiGet, apiPost, apiDelete } from '@/lib/api';

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
  place_city: string | null;
  place_state: string | null;
  user_display_name: string | null;
  user_id: string;
}

export async function fetchAllUsers() {
  return apiGet<UserWithRoles[]>('/api/admin/users');
}

export async function fetchUnverifiedSubmissions() {
  return apiGet<UnverifiedSubmission[]>('/api/admin/submissions/unverified');
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
