-- Soft rejection state for submissions (distinct from delete: row is kept,
-- hidden from the public, and reversible). Rejected when rejected_at is set.
ALTER TABLE "submissions" ADD COLUMN "rejected_by" UUID;
ALTER TABLE "submissions" ADD COLUMN "rejected_at" TIMESTAMPTZ;
