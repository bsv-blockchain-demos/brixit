-- Create wallet_identities table to map wallet identity keys to Supabase auth users
-- This table is only accessible via Edge Functions with service role
CREATE TABLE public.wallet_identities (
  identity_key text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  certificate_serial text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  last_verified_at timestamptz,
  UNIQUE(user_id)  -- One wallet per user
);

-- Index for fast user_id lookups
CREATE INDEX idx_wallet_identities_user_id ON public.wallet_identities(user_id);

-- Enable RLS but prevent all direct client access
ALTER TABLE public.wallet_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access"
ON public.wallet_identities FOR ALL
USING (false);

COMMENT ON TABLE public.wallet_identities IS
'Maps wallet identity keys to Supabase auth users. Only accessible via Edge Functions with service role.';
