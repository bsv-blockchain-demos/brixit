-- Add index on submissions.verified (used by map-preview aggregation, public feed, leaderboards)
CREATE INDEX IF NOT EXISTS "submissions_verified_idx" ON "submissions"("verified");

-- Add index on submissions.brand_id (missing FK index; used in brand joins and autoVerify transactions)
CREATE INDEX IF NOT EXISTS "submissions_brand_id_idx" ON "submissions"("brand_id");

-- Drop redundant index on wallet_identities.user_id — the @unique constraint already creates one
DROP INDEX IF EXISTS "idx_wallet_identities_user_id";
