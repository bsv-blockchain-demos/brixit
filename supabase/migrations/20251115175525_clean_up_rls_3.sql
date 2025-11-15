-- ======================================================
-- COMPREHENSIVE SECURITY FIX: Remove PII exposure and tighten RLS
-- ======================================================
BEGIN;

-- ======================================================
-- 1) REMOVE EMAIL FROM USERS TABLE (use auth.users instead)
-- ======================================================

ALTER TABLE public.users DROP COLUMN IF EXISTS email CASCADE;

COMMENT ON TABLE public.users IS
'User profiles. Email is stored in auth.users only, not duplicated here.';

-- ======================================================
-- 2) FIX USERS TABLE RLS POLICIES (maintain admin access)
-- ======================================================

-- Users can view their own profile OR admins can view all
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_admin());

-- Same for UPDATE
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

-- INSERT: users can only create their own profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- DELETE: admins only
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
CREATE POLICY "Admins can delete users"
ON public.users
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ======================================================
-- 3) CREATE SAFE PROFILE VIEW (no email)
-- ======================================================

DROP VIEW IF EXISTS public.my_public_profile CASCADE;

CREATE VIEW public.my_public_profile
WITH (security_invoker = on) AS
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

COMMENT ON VIEW public.my_public_profile IS
'Safe profile view. Email is in auth.users only. Uses SECURITY INVOKER for proper RLS enforcement.';

-- ======================================================
-- 4) FIX PUBLIC_SUBMISSIONS VIEW (remove ALL PII)
-- ======================================================

DROP VIEW IF EXISTS public.public_submissions CASCADE;

CREATE VIEW public.public_submissions
WITH (security_invoker = on) AS
SELECT
  id,
  crop_id,
  brand_id,
  location_id,
  place_id,
  brix_value,
  assessment_date,
  purchase_date,
  verified,
  verified_at,
  crop_variety,
  harvest_time,
  farm_location,
  outlier_notes
FROM public.submissions
WHERE verified = true;

GRANT SELECT ON public.public_submissions TO anon, authenticated;

COMMENT ON VIEW public.public_submissions IS
'Safe public view of verified submissions. Excludes user_id, contributor_name, and verified_by to protect PII. Uses SECURITY INVOKER for proper access control.';

-- ======================================================
-- 5) TIGHTEN SUBMISSIONS TABLE RLS
-- ======================================================

-- Remove public read access to submissions table (force use of view)
DROP POLICY IF EXISTS "Public can read verified submissions" ON public.submissions;

-- Authenticated users can read their own submissions
DROP POLICY IF EXISTS "Users can read their own submissions" ON public.submissions;
CREATE POLICY "Users can read their own submissions"
ON public.submissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- Keep existing INSERT/UPDATE/DELETE policies (not shown here for brevity)

COMMENT ON TABLE public.submissions IS
'Submission data with RLS. Public access only through public_submissions view.';

-- ======================================================
-- 6) DOCUMENT SECURITY MODEL
-- ======================================================

COMMENT ON FUNCTION public.has_role(public.app_role) IS
'SECURITY DEFINER function to check user roles. Internal use only in RLS policies.';

COMMENT ON FUNCTION public.is_admin() IS
'SECURITY DEFINER function to check if current user is admin. Internal use only in RLS policies.';

COMMENT ON FUNCTION public.is_contributor_or_admin() IS
'SECURITY DEFINER function to check if current user is contributor or admin. Internal use only in RLS policies.';

COMMIT;
