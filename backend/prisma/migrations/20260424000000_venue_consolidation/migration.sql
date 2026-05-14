-- Venue Consolidation Migration
--
-- Replaces the Place + Location two-table model with a single Venue table.
-- Idempotent: all DDL uses IF EXISTS / IF NOT EXISTS guards so re-runs are safe.
-- Data migration preserves place IDs as venue IDs so existing FK relationships
-- (submissions.place_id → venue_id) can be set with a single UPDATE.

-- ─── 1. Drop views that reference columns we're removing ─────────────────────

DROP VIEW IF EXISTS public_submission_details CASCADE;

-- ─── 2. Create venues table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS venues (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT         NOT NULL,
  pos_type         TEXT,
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  street_address   TEXT,
  city             TEXT,
  state            TEXT,
  country          TEXT,
  verified         BOOLEAN      NOT NULL DEFAULT false,
  created_by_user_id UUID       REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venues_lat_lng ON venues(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_venues_city    ON venues(city);

-- ─── 3. Add new columns to submissions ───────────────────────────────────────

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS venue_id          UUID    REFERENCES venues(id) ON DELETE SET NULL;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS skip_venue_prompt BOOLEAN NOT NULL DEFAULT false;

-- ─── 4. Migrate place data → venues, then wire up submissions ─────────────────
--
-- Only runs if the old places table still exists (safe to skip on clean installs).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'places'
  ) THEN

    -- Insert one venue per place, reusing the place's UUID so we can map
    -- submissions.place_id → venue_id with a single UPDATE below.
    INSERT INTO venues (id, name, pos_type, latitude, longitude,
                        street_address, city, state, country,
                        verified, created_by_user_id, created_at)
    SELECT
      p.id,
      COALESCE(
        (SELECT l.name FROM locations l WHERE l.id = p.location_id LIMIT 1),
        p.label,
        NULLIF(TRIM(CONCAT_WS(', ',
          p.street_address, p.city, p.country
        )), ''),
        'Unknown Location'
      ),
      NULL,             -- pos_type unknown at migration time
      p.latitude,
      p.longitude,
      p.street_address,
      p.city,
      p.state,
      p.country,
      true,             -- system-created → verified
      NULL,
      now()             -- places table has no created_at; backfill to migration time
    FROM places p
    ON CONFLICT (id) DO NOTHING;  -- idempotent re-run guard

    -- Point submissions at their new venue (same UUID, so direct copy)
    UPDATE submissions
    SET venue_id = place_id
    WHERE place_id IS NOT NULL
      AND venue_id IS NULL;

  END IF;
END $$;

-- ─── 5. Drop old columns from submissions ─────────────────────────────────────

ALTER TABLE submissions DROP COLUMN IF EXISTS place_id;
ALTER TABLE submissions DROP COLUMN IF EXISTS location_id;

-- ─── 6. Drop old tables ───────────────────────────────────────────────────────

DROP TABLE IF EXISTS locations     CASCADE;
DROP TABLE IF EXISTS places        CASCADE;
DROP TABLE IF EXISTS location_types CASCADE;
