-- ======================================================
-- FIX: Allow public access to verified submissions
-- ======================================================
BEGIN;

-- Add policy to allow anyone to read verified submissions
-- This is required because public_submissions view uses security_invoker
CREATE POLICY "Anyone can read verified submissions"
ON public.submissions
FOR SELECT
TO anon, authenticated
USING (verified = true);

COMMENT ON POLICY "Anyone can read verified submissions" ON public.submissions IS
'Allows anonymous and authenticated users to view verified submissions through the public_submissions view. The view uses security_invoker, so this policy is required.';

COMMIT;
