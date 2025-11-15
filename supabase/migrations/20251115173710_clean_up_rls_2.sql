BEGIN;

-- Drop and recreate public_submissions WITHOUT verified_by UUID
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
'Public view of verified submissions. Excludes user_id, contributor_name, and verified_by to protect PII. Uses SECURITY INVOKER for proper access control.';

-- Recreate my_public_profile with explicit SECURITY INVOKER
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
'Safe profile view excluding email. Uses SECURITY INVOKER and relies on users table RLS policies for access control.';

COMMIT;
