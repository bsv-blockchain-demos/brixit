import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'contributor' | 'user';

export interface AdminCreateUserInput {
  email: string;
  password: string;
  displayName: string;
  country?: string;
  state?: string;
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
  roles: AppRole[]; // do NOT require email here
}

export interface UnverifiedSubmission {
  id: string;
  assessment_date: string | null;
  brix_value: number;
  verified: boolean;
  // Flattened fields expected from RPC; adjust only if your RPC returns different names
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
      state: input.state,
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
