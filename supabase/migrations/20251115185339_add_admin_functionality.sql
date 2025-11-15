BEGIN;

-- =====================================================
-- ADMIN FUNCTION 1: Verify/Unverify Submissions
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_verify_submission(
  submission_id_param uuid,
  verify_bool boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows int;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin access required'
    );
  END IF;

  -- Update submission
  UPDATE public.submissions
  SET 
    verified = verify_bool,
    verified_at = CASE WHEN verify_bool THEN now() ELSE NULL END,
    verified_by = CASE WHEN verify_bool THEN auth.uid() ELSE NULL END
  WHERE id = submission_id_param;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  IF affected_rows = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Submission not found'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Submission ' || CASE WHEN verify_bool THEN 'verified' ELSE 'unverified' END,
    'submission_id', submission_id_param
  );
END;
$$;

COMMENT ON FUNCTION public.admin_verify_submission IS 
'SECURITY DEFINER function for admins to verify or unverify submissions. Protected with is_admin() check.';


-- =====================================================
-- ADMIN FUNCTION 2: Grant Role to User
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_grant_role(
  target_user_id uuid,
  role_to_grant app_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin access required'
    );
  END IF;

  -- Verify target user exists
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = target_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Insert role (ON CONFLICT DO NOTHING in case already exists)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, role_to_grant)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Role ' || role_to_grant || ' granted to user',
    'user_id', target_user_id,
    'role', role_to_grant
  );
END;
$$;

COMMENT ON FUNCTION public.admin_grant_role IS 
'SECURITY DEFINER function for admins to grant roles to users. Protected with is_admin() check.';


-- =====================================================
-- ADMIN FUNCTION 3: Revoke Role from User
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_revoke_role(
  target_user_id uuid,
  role_to_revoke app_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows int;
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin access required'
    );
  END IF;

  -- Prevent removing admin role from yourself
  IF target_user_id = auth.uid() AND role_to_revoke = 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot revoke admin role from yourself'
    );
  END IF;

  -- Delete role
  DELETE FROM public.user_roles
  WHERE user_id = target_user_id AND role = role_to_revoke;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  IF affected_rows = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User does not have this role'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Role ' || role_to_revoke || ' revoked from user',
    'user_id', target_user_id,
    'role', role_to_revoke
  );
END;
$$;

COMMENT ON FUNCTION public.admin_revoke_role IS 
'SECURITY DEFINER function for admins to revoke roles from users. Protected with is_admin() check. Prevents self-demotion.';


-- =====================================================
-- ADMIN FUNCTION 4: Get All Users (for admin dashboard)
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_get_all_users()
RETURNS TABLE (
  id uuid,
  display_name text,
  country text,
  state text,
  city text,
  points integer,
  submission_count integer,
  created_at timestamptz,
  roles app_role[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.display_name,
    u.country,
    u.state,
    u.city,
    u.points,
    u.submission_count,
    u.created_at,
    COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), ARRAY[]::app_role[]) as roles
  FROM public.users u
  LEFT JOIN public.user_roles ur ON u.id = ur.user_id
  GROUP BY u.id, u.display_name, u.country, u.state, u.city, u.points, u.submission_count, u.created_at
  ORDER BY u.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.admin_get_all_users IS 
'SECURITY DEFINER function for admins to view all users with their roles. Protected with is_admin() check.';


-- =====================================================
-- ADMIN FUNCTION 5: Get Unverified Submissions Queue
-- =====================================================

CREATE OR REPLACE FUNCTION public.admin_get_unverified_submissions()
RETURNS TABLE (
  id uuid,
  assessment_date timestamptz,
  brix_value numeric,
  crop_name text,
  crop_label text,
  brand_name text,
  brand_label text,
  place_label text,
  place_city text,
  place_state text,
  user_display_name text,
  user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN QUERY
  SELECT 
    s.id,
    s.assessment_date,
    s.brix_value,
    c.name as crop_name,
    c.label as crop_label,
    b.name as brand_name,
    b.label as brand_label,
    p.label as place_label,
    p.city as place_city,
    p.state as place_state,
    u.display_name as user_display_name,
    s.user_id
  FROM public.submissions s
  LEFT JOIN public.crops c ON s.crop_id = c.id
  LEFT JOIN public.brands b ON s.brand_id = b.id
  LEFT JOIN public.places p ON s.place_id = p.id
  LEFT JOIN public.users u ON s.user_id = u.id
  WHERE s.verified = false
  ORDER BY s.assessment_date DESC;
END;
$$;

COMMENT ON FUNCTION public.admin_get_unverified_submissions IS 
'SECURITY DEFINER function for admins to view unverified submissions queue. Protected with is_admin() check.';


-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION public.admin_verify_submission TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_all_users TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_unverified_submissions TO authenticated;


-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✓ Admin functions created successfully';
  RAISE NOTICE '  - admin_verify_submission: Verify/unverify submissions';
  RAISE NOTICE '  - admin_grant_role: Grant roles to users';
  RAISE NOTICE '  - admin_revoke_role: Revoke roles from users';
  RAISE NOTICE '  - admin_get_all_users: View all users with roles';
  RAISE NOTICE '  - admin_get_unverified_submissions: View submission queue';
END
$$;

COMMIT;
