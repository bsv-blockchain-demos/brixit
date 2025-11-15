drop view if exists "public"."submission_with_outliers";

create or replace view "public"."submission_with_outliers" as  SELECT s.id,
    s.assessment_date AS "timestamp",
    s.crop_id,
    s.place_id AS location_id,
    s.location_id AS store_id,
    s.brand_id,
    s.crop_variety AS label,
    s.brix_value,
    c.poor_brix,
    c.average_brix,
    c.good_brix,
    c.excellent_brix,
    c.category,
    ((s.brix_value < ((c.poor_brix + c.average_brix) / (2)::numeric)) OR (s.brix_value > ((c.good_brix + c.excellent_brix) / (2)::numeric))) AS is_outlier
   FROM (public.submissions s
     JOIN public.crops c ON ((s.crop_id = c.id)));


drop policy "admin_delete_submission_images" on "storage"."objects";


  create policy "admin_delete_submission_images"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = ( SELECT buckets.id
   FROM storage.buckets
  WHERE (buckets.name = 'submission-images-bucket'::text))) AND (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text))))));



