-- ======================================================
-- SECURE Migration: RLS fixes using existing SECURITY DEFINER functions
-- Updated for current public.users schema (no updated_at column)
-- ======================================================
BEGIN;

-- ======================================================
-- 1) Submissions: safe public view + verified-only policy
-- ======================================================

CREATE OR REPLACE VIEW public.public_submissions AS
SELECT
  s.id,
  s.crop_id,
  s.brand_id,
  s.location_id,
  s.place_id,
  s.brix_value,
  s.assessment_date,
  s.purchase_date,
  s.verified,
  s.verified_at,
  s.verified_by,
  s.crop_variety,
  s.harvest_time,
  s.farm_location,
  s.outlier_notes
FROM public.submissions s
WHERE s.verified = true;

GRANT SELECT ON public.public_submissions TO anon;
GRANT SELECT ON public.public_submissions TO authenticated;

ALTER TABLE IF EXISTS public.submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read verified submissions" ON public.submissions;

CREATE POLICY "Public can read verified submissions"
ON public.submissions
FOR SELECT
TO public
USING (verified = true);

COMMENT ON POLICY "Public can read verified submissions" ON public.submissions IS
'Allows public to query verified submissions. Applications should use public_submissions view to avoid exposing user_id and contributor_name.';

-- ======================================================
-- 2) Users table: use SECURITY DEFINER is_admin() in policies
-- ======================================================

ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.users FROM anon;
REVOKE ALL ON public.users FROM public;

-- SELECT policy: owner or admin
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile"
ON public.users
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR public.is_admin()
);

-- UPDATE policy: owner or admin
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

-- INSERT policy: owner only
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- DELETE policy: admin only
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
CREATE POLICY "Admins can delete users"
ON public.users
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Safe frontend view for profiles (no email or PII)
CREATE OR REPLACE VIEW public.my_public_profile AS
SELECT
  id,
  display_name,
  points,
  submission_count,
  last_submission,
  country,
  state,
  city,
  created_at
FROM public.users;

GRANT SELECT ON public.my_public_profile TO authenticated;

-- ======================================================
-- 4) Harden SECURITY DEFINER functions (set search_path) SAFELY
-- ======================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'has_role' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.has_role(public.app_role) SET search_path = public';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'is_admin' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.is_admin() SET search_path = public';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'is_contributor_or_admin' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.is_contributor_or_admin() SET search_path = public';
  END IF;
END
$$;

COMMENT ON FUNCTION public.has_role(public.app_role) IS
'SECURITY DEFINER function to check user roles. Expected to be SECURITY DEFINER and run with search_path=public. Used by RLS policies to detect admin/contributor roles.';
COMMENT ON FUNCTION public.is_admin() IS
'SECURITY DEFINER function to check if current user is admin. Intended for use in RLS policies.';
COMMENT ON FUNCTION public.is_contributor_or_admin() IS
'SECURITY DEFINER function to check if current user is contributor or admin.';

COMMIT;
