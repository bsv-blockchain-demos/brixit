-- Per-reading PushDrop outpoint in 'txid.vout' form.
-- NULL → broadcast pending or failed.
-- Idempotent: re-runs after partial failures are safe.

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS outpoint TEXT;

CREATE INDEX IF NOT EXISTS submissions_outpoint_idx ON submissions(outpoint);
