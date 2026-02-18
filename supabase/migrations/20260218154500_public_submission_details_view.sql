BEGIN;

DROP VIEW IF EXISTS public.public_submission_details;

CREATE VIEW public.public_submission_details
WITH (security_invoker = on) AS
SELECT
  s.id,
  s.assessment_date,
  s.brix_value,
  s.verified,
  s.verified_at,
  s.crop_variety,
  s.outlier_notes,
  s.purchase_date,
  s.crop_id,
  c.name AS crop_name,
  c.label AS crop_label,
  c.poor_brix,
  c.average_brix,
  c.good_brix,
  c.excellent_brix,
  c.category,
  s.brand_id,
  b.name AS brand_name,
  b.label AS brand_label,
  s.location_id,
  l.name AS location_name,
  l.label AS location_label,
  s.place_id,
  p.label AS place_label,
  p.latitude,
  p.longitude,
  p.street_address,
  p.city,
  p.state,
  p.country
FROM public.submissions s
LEFT JOIN public.crops c ON c.id = s.crop_id
LEFT JOIN public.brands b ON b.id = s.brand_id
LEFT JOIN public.locations l ON l.id = s.location_id
LEFT JOIN public.places p ON p.id = s.place_id
WHERE s.verified = true;

GRANT SELECT ON public.public_submission_details TO anon, authenticated;

COMMENT ON VIEW public.public_submission_details IS
'Safe public view of verified submissions with joined place/crop/brand/location metadata. Excludes user_id, contributor_name, and verified_by. Uses SECURITY INVOKER for proper access control.';

COMMIT;
