-- Brixit Database Seed: Helper functions, leaderboard RPCs, and views
-- Run after Prisma migrations: psql $DATABASE_URL -f prisma/seed.sql

-- ─── Helper: Normalize brix value to 1.0–2.0 scale ──────────────────────────

CREATE OR REPLACE FUNCTION get_normalized_brix_1_to_2(crop_id_arg uuid, brix_value_arg numeric)
RETURNS numeric AS $$
DECLARE
    poor_brix numeric;
    excellent_brix numeric;
    denominator numeric;
BEGIN
    SELECT c.poor_brix, c.excellent_brix
    INTO poor_brix, excellent_brix
    FROM crops c
    WHERE c.id = crop_id_arg;

    denominator := excellent_brix - poor_brix;
    IF denominator IS NULL OR denominator = 0 THEN
        RETURN 1.5;
    END IF;

    RETURN 1.0 + LEAST(1.0, GREATEST(0.0,
        (brix_value_arg - poor_brix) / denominator
    ));
END;
$$ LANGUAGE plpgsql;

-- ─── View: public_submission_details ─────────────────────────────────────────

CREATE OR REPLACE VIEW public_submission_details AS
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
FROM submissions s
LEFT JOIN crops c ON c.id = s.crop_id
LEFT JOIN brands b ON b.id = s.brand_id
LEFT JOIN locations l ON l.id = s.location_id
LEFT JOIN places p ON p.id = s.place_id
WHERE s.verified = true;

-- ─── Leaderboard: Brand ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_brand_leaderboard(
  country_filter text DEFAULT NULL,
  state_filter text DEFAULT NULL,
  city_filter text DEFAULT NULL,
  crop_filter text DEFAULT NULL,
  limit_count integer DEFAULT 50,
  offset_count integer DEFAULT 0
)
RETURNS TABLE (
  brand_id uuid,
  brand_name text,
  brand_label text,
  average_normalized_score numeric,
  average_brix numeric,
  submission_count bigint,
  grade text,
  rank integer
)
LANGUAGE sql STABLE AS $$
  WITH base AS (
    SELECT
      b.id AS brand_id,
      b.name AS brand_name,
      COALESCE(b.label, b.name) AS brand_label,
      AVG(get_normalized_brix_1_to_2(s.crop_id, s.brix_value)) AS average_normalized_score,
      AVG(s.brix_value) AS average_brix,
      COUNT(*) AS submission_count
    FROM submissions s
    JOIN brands b ON s.brand_id = b.id
    JOIN places p ON s.place_id = p.id
    LEFT JOIN crops c ON s.crop_id = c.id
    WHERE
      (country_filter IS NULL OR lower(p.country) = lower(country_filter))
      AND (state_filter IS NULL OR lower(p.state) = lower(state_filter))
      AND (city_filter IS NULL OR lower(p.city) = lower(city_filter))
      AND (crop_filter IS NULL OR lower(c.name) = lower(crop_filter))
    GROUP BY b.id, b.name, b.label
  ),
  ranked AS (
    SELECT
      brand_id, brand_name, brand_label,
      average_normalized_score, average_brix, submission_count,
      CASE
        WHEN average_normalized_score >= 1.75 THEN 'Excellent'
        WHEN average_normalized_score >= 1.5 THEN 'Good'
        WHEN average_normalized_score >= 1.25 THEN 'Poor'
        ELSE 'Needs Improvement'
      END AS grade,
      RANK() OVER (ORDER BY average_normalized_score DESC) AS rank
    FROM base
  )
  SELECT * FROM ranked ORDER BY rank
  LIMIT GREATEST(1, LEAST(limit_count, 200))
  OFFSET GREATEST(offset_count, 0);
$$;

-- ─── Leaderboard: Crop ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_crop_leaderboard(
  country_filter text DEFAULT NULL,
  state_filter text DEFAULT NULL,
  city_filter text DEFAULT NULL,
  crop_filter text DEFAULT NULL,
  limit_count integer DEFAULT 50,
  offset_count integer DEFAULT 0
)
RETURNS TABLE (
  crop_id uuid,
  crop_name text,
  crop_label text,
  average_normalized_score numeric,
  average_brix numeric,
  submission_count bigint,
  grade text,
  rank integer
)
LANGUAGE sql STABLE AS $$
  WITH base AS (
    SELECT
      c.id AS crop_id,
      c.name AS crop_name,
      COALESCE(c.label, c.name) AS crop_label,
      AVG(get_normalized_brix_1_to_2(s.crop_id, s.brix_value)) AS average_normalized_score,
      AVG(s.brix_value) AS average_brix,
      COUNT(*) AS submission_count
    FROM submissions s
    JOIN crops c ON s.crop_id = c.id
    JOIN places p ON s.place_id = p.id
    LEFT JOIN locations l ON p.location_id = l.id
    WHERE
      (country_filter IS NULL OR lower(p.country) = lower(country_filter))
      AND (state_filter IS NULL OR lower(p.state) = lower(state_filter))
      AND (city_filter IS NULL OR lower(p.city) = lower(city_filter))
      AND (crop_filter IS NULL OR lower(c.name) = lower(crop_filter))
    GROUP BY c.id, c.name, c.label
  ),
  ranked AS (
    SELECT
      crop_id, crop_name, crop_label,
      average_normalized_score, average_brix, submission_count,
      CASE
        WHEN average_normalized_score >= 1.75 THEN 'Excellent'
        WHEN average_normalized_score >= 1.5 THEN 'Good'
        WHEN average_normalized_score >= 1.25 THEN 'Poor'
        ELSE 'Needs Improvement'
      END AS grade,
      RANK() OVER (ORDER BY average_normalized_score DESC) AS rank
    FROM base
  )
  SELECT * FROM ranked ORDER BY rank
  LIMIT GREATEST(1, LEAST(limit_count, 200))
  OFFSET GREATEST(offset_count, 0);
$$;

-- ─── Leaderboard: Location ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_location_leaderboard(
  country_filter text DEFAULT NULL,
  state_filter text DEFAULT NULL,
  city_filter text DEFAULT NULL,
  crop_filter text DEFAULT NULL,
  limit_count integer DEFAULT 50,
  offset_count integer DEFAULT 0
)
RETURNS TABLE (
  location_id uuid,
  location_name text,
  location_label text,
  city text,
  state text,
  country text,
  average_normalized_score numeric,
  average_brix numeric,
  submission_count bigint,
  grade text,
  rank integer
)
LANGUAGE sql STABLE AS $$
  WITH base AS (
    SELECT
      p.id AS location_id,
      COALESCE(l.name, p.label, concat_ws(', ', p.city, p.state, p.country)) AS location_name,
      COALESCE(l.label, NULL) AS location_label,
      p.city,
      p.state,
      p.country,
      AVG(get_normalized_brix_1_to_2(s.crop_id, s.brix_value)) AS average_normalized_score,
      AVG(s.brix_value) AS average_brix,
      COUNT(*) AS submission_count
    FROM submissions s
    JOIN places p ON s.place_id = p.id
    LEFT JOIN locations l ON p.location_id = l.id
    LEFT JOIN crops c ON s.crop_id = c.id
    WHERE
      (country_filter IS NULL OR lower(p.country) = lower(country_filter))
      AND (state_filter IS NULL OR lower(p.state) = lower(state_filter))
      AND (city_filter IS NULL OR lower(p.city) = lower(city_filter))
      AND (crop_filter IS NULL OR lower(c.name) = lower(crop_filter))
    GROUP BY p.id, l.name, l.label, p.label, p.city, p.state, p.country
  ),
  ranked AS (
    SELECT
      location_id, location_name, location_label, city, state, country,
      average_normalized_score, average_brix, submission_count,
      CASE
        WHEN average_normalized_score >= 1.75 THEN 'Excellent'
        WHEN average_normalized_score >= 1.5 THEN 'Good'
        WHEN average_normalized_score >= 1.25 THEN 'Poor'
        ELSE 'Needs Improvement'
      END AS grade,
      RANK() OVER (ORDER BY average_normalized_score DESC) AS rank
    FROM base
  )
  SELECT * FROM ranked ORDER BY rank
  LIMIT GREATEST(1, LEAST(limit_count, 200))
  OFFSET GREATEST(offset_count, 0);
$$;

-- ─── Leaderboard: User (safe — no PII) ──────────────────────────────────────

CREATE OR REPLACE FUNCTION get_user_leaderboard_safe(
  country_filter text DEFAULT NULL,
  state_filter text DEFAULT NULL,
  city_filter text DEFAULT NULL,
  crop_filter text DEFAULT NULL,
  limit_count integer DEFAULT 50,
  offset_count integer DEFAULT 0
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
LANGUAGE sql STABLE AS $$
  WITH filtered_submissions AS (
    SELECT
      s.id,
      s.brix_value,
      s.contributor_name,
      p.city,
      p.state,
      p.country,
      c.name as crop_name,
      c.poor_brix,
      c.average_brix,
      c.good_brix,
      c.excellent_brix
    FROM submissions s
    JOIN places p ON s.place_id = p.id
    JOIN crops c ON s.crop_id = c.id
    WHERE s.verified = true
      AND (country_filter IS NULL OR p.country = country_filter)
      AND (state_filter IS NULL OR p.state = state_filter)
      AND (city_filter IS NULL OR p.city = city_filter)
      AND (crop_filter IS NULL OR c.name = crop_filter)
  ),
  user_stats AS (
    SELECT
      COALESCE(fs.contributor_name, 'Anonymous User') as user_name,
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
    GROUP BY COALESCE(fs.contributor_name, 'Anonymous User')
  ),
  ranked AS (
    SELECT
      us.user_name::text as entity_name,
      us.user_name::text as entity_id,
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
$$;
