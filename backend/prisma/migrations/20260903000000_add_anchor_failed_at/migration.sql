-- Timestamp of the most recent failed anchor task (EDIT re-anchor, DELETE spend,
-- or retry). NULL means the last attempt succeeded or none has failed. Distinct
-- from `outpoint` being NULL: an EDIT/DELETE failure leaves `outpoint` populated
-- and stale, so this is the only signal that the on-chain state no longer
-- matches the database row.
ALTER TABLE "submissions" ADD COLUMN "anchor_failed_at" TIMESTAMPTZ;
