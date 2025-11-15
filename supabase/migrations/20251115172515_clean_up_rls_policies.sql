-- Remove duplicate DELETE policy (keep "Admins can delete users")
DROP POLICY IF EXISTS "Admins can delete any user" ON public.users;

-- Remove duplicate INSERT policy (keep "Users can insert their own profile")  
DROP POLICY IF EXISTS "Allow user profile creation" ON public.users;

-- Remove duplicate UPDATE policy (keep "Users can update their own profile")
DROP POLICY IF EXISTS "Users can edit their own profile" ON public.users;

-- Drop and recreate without SECURITY DEFINER
DROP VIEW IF EXISTS public.public_submissions CASCADE;
DROP VIEW IF EXISTS public.my_public_profile CASCADE;

CREATE VIEW public.public_submissions AS
SELECT
  id, crop_id, brand_id, location_id, place_id,
  brix_value, assessment_date, purchase_date,
  verified, verified_at, verified_by,
  crop_variety, harvest_time, farm_location, outlier_notes
FROM public.submissions
WHERE verified = true;

CREATE VIEW public.my_public_profile AS
SELECT
  id, display_name, points, submission_count,
  last_submission, country, state, city, created_at
FROM public.users;

-- Grant permissions
GRANT SELECT ON public.public_submissions TO anon, authenticated;
GRANT SELECT ON public.my_public_profile TO authenticated;