-- The leaderboard grouped by submissions.contributor_name, a name copied onto
-- the row at submit time and never updated after, so anyone who renamed
-- themselves still ranked under the old value. Group by user_id and join for
-- the name instead.

CREATE OR REPLACE FUNCTION get_user_leaderboard_safe(
  country_filter text DEFAULT NULL,
  state_filter   text DEFAULT NULL,
  city_filter    text DEFAULT NULL,
  crop_filter    text DEFAULT NULL,
  store_filter   text DEFAULT NULL,
  limit_count    integer DEFAULT 50,
  offset_count   integer DEFAULT 0
)
RETURNS TABLE (
  entity_name text,
  entity_id text,
  entity_type text,
  submission_count bigint,
  average_brix numeric,
  average_normalized_score numeric,
  rank bigint
)
LANGUAGE sql STABLE AS $fn$
  WITH filtered_submissions AS (
    SELECT
      s.id,
      s.user_id,
      s.brix_value,
      v.city,
      v.state,
      v.country,
      c.name as crop_name,
      c.poor_brix,
      c.average_brix,
      c.good_brix,
      c.excellent_brix
    FROM submissions s
    LEFT JOIN venues v ON s.venue_id = v.id
    JOIN crops c ON s.crop_id = c.id
    WHERE s.verified = true
      AND (s.skip_venue_prompt = false OR s.skip_venue_prompt IS NULL)
      AND (country_filter IS NULL OR v.country = country_filter)
      AND (state_filter IS NULL OR v.state = state_filter)
      AND (city_filter IS NULL OR v.city = city_filter)
      AND (crop_filter IS NULL OR c.name = crop_filter)
      AND (store_filter IS NULL OR lower(v.name) = lower(store_filter))
  ),
  user_stats AS (
    SELECT
      fs.user_id,
      -- Name, else the identity key: nameless contributors stay distinguishable.
      COALESCE(NULLIF(btrim(u.display_name), ''), wi.identity_key, 'Anonymous User') as user_name,
      COUNT(*) as total_submissions,
      AVG(fs.brix_value) as avg_brix,
      AVG(
        CASE
          WHEN fs.brix_value >= fs.excellent_brix THEN 1.0
          WHEN fs.brix_value >= fs.good_brix THEN 0.75
          WHEN fs.brix_value >= fs.average_brix THEN 0.5
          WHEN fs.brix_value >= fs.poor_brix THEN 0.25
          ELSE 0.0
        END
      ) as avg_normalized_score
    FROM filtered_submissions fs
    LEFT JOIN users u ON u.id = fs.user_id
    LEFT JOIN wallet_identities wi ON wi.user_id = fs.user_id
    -- Rows with no user_id share the NULL group and rank as one entry.
    GROUP BY fs.user_id, u.display_name, wi.identity_key
  ),
  ranked AS (
    SELECT
      us.user_name::text as entity_name,
      COALESCE(us.user_id::text, us.user_name)::text as entity_id,
      'user'::text as entity_type,
      us.total_submissions as submission_count,
      ROUND(us.avg_brix, 2) as average_brix,
      ROUND(us.avg_normalized_score, 3) as average_normalized_score,
      ROW_NUMBER() OVER (ORDER BY us.total_submissions DESC, us.avg_normalized_score DESC) as rank
    FROM user_stats us
  )
  SELECT * FROM ranked ORDER BY rank
  LIMIT GREATEST(1, LEAST(limit_count, 200))
  OFFSET GREATEST(offset_count, 0);
$fn$;

-- contributor_name is now unreachable from every read path. The drop is only
-- lossless while every named row carries the user_id the join needs, so refuse
-- rather than discard what cannot be reconstructed.
DO $guard$
DECLARE
  orphaned bigint;
BEGIN
  SELECT count(*) INTO orphaned
  FROM submissions
  WHERE user_id IS NULL
    AND btrim(COALESCE(contributor_name, '')) <> '';

  IF orphaned > 0 THEN
    RAISE EXCEPTION
      'Refusing to drop submissions.contributor_name: % row(s) carry a name but no user_id, so the join cannot recover it. Link those rows to a user, or clear their contributor_name, then re-run this migration.', orphaned;
  END IF;
END
$guard$;

ALTER TABLE "submissions" DROP COLUMN "contributor_name";
