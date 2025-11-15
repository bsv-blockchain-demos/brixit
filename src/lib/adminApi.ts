import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'contributor' | 'user';

export interface AdminCreateUserInput {
  email: string;
  password: string;
  displayName: string;
  country?: string;
  countryCode?: string;
  state?: string;
  stateCode?: string;
  city?: string;
}

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

export async function createUser(input: AdminCreateUserInput) {
  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: {
      email: input.email,
      password: input.password,
      display_name: input.displayName,
      country: input.country,
      country_code: input.countryCode,
      state: input.state,
      state_code: input.stateCode,
      city: input.city,
    },
  });
  if (error) throw error;
  return data as (AdminResponse & { user?: { id: string; email: string } });
}

export async function fetchAllUsers() {
  const { data, error } = await (supabase.rpc as any)('admin_get_all_users');
  if (error) throw error;
  return data as UserWithRoles[];
}

export async function fetchUnverifiedSubmissions() {
  const { data, error } = await (supabase.rpc as any)('admin_get_unverified_submissions');
  if (error) throw error;
  return data as UnverifiedSubmission[];
}

export async function grantRole(userId: string, role: Extract<AppRole, 'admin' | 'contributor'>) {
  const { data, error } = await (supabase.rpc as any)('admin_grant_role', {
    target_user_id: userId,
    role_to_grant: role,
  });
  if (error) throw error;
  return data as AdminResponse;
}

export async function revokeRole(userId: string, role: Extract<AppRole, 'admin' | 'contributor'>) {
  const { data, error } = await (supabase.rpc as any)('admin_revoke_role', {
    target_user_id: userId,
    role_to_revoke: role,
  });
  if (error) throw error;
  return data as AdminResponse;
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
  const { data, error } = await (supabase.rpc as any)('admin_verify_submission', {
    submission_id_param: submissionId,
    verify_bool: verify,
  });
  if (error) throw error;
  return data as AdminResponse;
}

export async function deleteSubmission(submissionId: string) {
  const { error } = await supabase.from('submissions').delete().eq('id', submissionId);
  if (error) throw error;
}
