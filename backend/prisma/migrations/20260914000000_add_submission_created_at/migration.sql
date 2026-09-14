-- Submissions had no creation timestamp: assessment_date is user-supplied and
-- backdatable, so it can't measure when rows actually landed.
ALTER TABLE "submissions" ADD COLUMN "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill from verified_at, the closest surviving record. Unverified rows fall
-- back to the migration time, so pre-migration history is approximate.
UPDATE "submissions" SET "created_at" = COALESCE("verified_at", CURRENT_TIMESTAMP);

CREATE INDEX "submissions_created_at_idx" ON "submissions"("created_at");
