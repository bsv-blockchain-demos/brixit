BEGIN;

-- =====================================================
-- SECURITY FIX 1: Restrict Places Table Access
-- =====================================================
-- Issue: Anonymous users can read home addresses and shopping locations
-- Fix: Restrict to authenticated users only

DROP POLICY IF EXISTS "Public can read locations" ON public.places;

CREATE POLICY "Authenticated users can read places"
ON public.places
FOR SELECT
TO authenticated
USING (true);

COMMENT ON TABLE public.places IS 
'Places contain sensitive location data (addresses, GPS coordinates). Access restricted to authenticated users only to prevent customer tracking.';


-- =====================================================
-- SECURITY FIX 2: Remove Exposed User Profile View
-- =====================================================
-- Issue: my_public_profile view exposes user activity and location data
-- Fix: Drop the view entirely (not needed for current app functionality)

DROP VIEW IF EXISTS public.my_public_profile CASCADE;

COMMENT ON TABLE public.users IS 
'User profiles. Protected by RLS - users can only see their own profile unless admin. Personal location data not exposed publicly.';


-- =====================================================
-- SECURITY FIX 3: Fix Function Search Paths
-- =====================================================
-- Issue: Security linter warns about mutable search paths in SECURITY DEFINER functions
-- Fix: Set explicit search_path = public on all role-checking functions

-- Note: The correct function signature is has_role(public.app_role)
-- NOT has_role(uuid, app_role) - the function uses auth.uid() internally

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'has_role' AND n.nspname = 'public'
  ) THEN
    -- Use correct signature: one parameter only
    ALTER FUNCTION public.has_role(public.app_role) SET search_path = public;
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
    ALTER FUNCTION public.is_admin() SET search_path = public;
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
    ALTER FUNCTION public.is_contributor_or_admin() SET search_path = public;
  END IF;
END
$$;


-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify places is protected
DO $$
DECLARE
  policy_count int;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'places'
    AND policyname = 'Public can read locations';
  
  IF policy_count > 0 THEN
    RAISE EXCEPTION 'SECURITY ERROR: Public read policy still exists on places table';
  END IF;
  
  RAISE NOTICE '✓ Places table is now protected - only authenticated users can access';
END
$$;

-- Verify view is dropped
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'my_public_profile'
  ) THEN
    RAISE EXCEPTION 'SECURITY ERROR: my_public_profile view still exists';
  END IF;
  
  RAISE NOTICE '✓ my_public_profile view removed - user tracking prevented';
END
$$;

COMMIT;
