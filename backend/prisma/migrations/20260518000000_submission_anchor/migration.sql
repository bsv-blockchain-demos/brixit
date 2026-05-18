-- Submission On-Chain Anchor
--
-- Adds a single `outpoint` column to `submissions` to track this reading's
-- PushDrop UTXO in 'txid.vout' form.
--
--   NULL              → broadcast pending or failed
--   '<txid>.<vout>'   → anchored on chain (UI links the txid to WhatsOnChain)
--
-- Sibling rows from the same submission session share the same txid prefix
-- but have different vouts (one PushDrop output per reading in the tx).
-- EDIT updates `outpoint` in place. DELETE removes the row entirely; the
-- on-chain history (walked via PushDrop inputs / wallet.listActions) remains
-- the source of truth for the full lifecycle.
--
-- Idempotent: IF NOT EXISTS guards so re-runs after a partial failure are safe.

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS outpoint TEXT;

CREATE INDEX IF NOT EXISTS submissions_outpoint_idx ON submissions(outpoint);
