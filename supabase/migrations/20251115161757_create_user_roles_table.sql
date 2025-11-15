-- ============================================
-- 1. Create the new application role enum
-- ============================================
CREATE TYPE public.app_role AS ENUM (
    'admin',
    'contributor',
    'viewer'
);

------------------------------------------------------------

-- ============================================
-- 2. Create the user_roles table
-- ============================================
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view only their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

------------------------------------------------------------

-- ============================================
-- 3. Helper RLS Functions
-- ============================================

-- Has role?
CREATE OR REPLACE FUNCTION public.has_role(check_role public.app_role)
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = check_role
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- Admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
    SELECT public.has_role('admin');
$$ LANGUAGE sql SECURITY DEFINER;

-- Contributor or admin?
CREATE OR REPLACE FUNCTION public.is_contributor_or_admin()
RETURNS boolean AS $$
    SELECT public.has_role('contributor') OR public.has_role('admin');
$$ LANGUAGE sql SECURITY DEFINER;

------------------------------------------------------------

-- ============================================
-- 4. Migrate roles from public.users → user_roles
-- ============================================

-- Safe cast into new enum
INSERT INTO public.user_roles (user_id, role)
SELECT
    id,
    CASE
        WHEN role IN ('admin','contributor','viewer')
            THEN role::public.app_role
        ELSE 'viewer'::public.app_role
    END
FROM public.users
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

------------------------------------------------------------

-- ============================================
-- 5. Cleanup old role system
-- ============================================

-- Drop role-related indexes
DROP INDEX IF EXISTS public.idx_users_role;
DROP INDEX IF EXISTS public.users_role_idx;

-- Drop dependent policies (required before removal)
-- submission_images
DROP POLICY IF EXISTS "users_read_submission_images" ON public.submission_images;
DROP POLICY IF EXISTS "admin_update_submission_images" ON public.submission_images;
DROP POLICY IF EXISTS "Authenticated users can read submission images" ON public.submission_images;
DROP POLICY IF EXISTS "Admins can delete submission images" ON public.submission_images;

-- storage.objects
DROP POLICY IF EXISTS "admin_delete_submission_images" ON storage.objects;

-- locations / places
DROP POLICY IF EXISTS "Contributors and admins can insert stores" ON public.locations;
DROP POLICY IF EXISTS "Admins can update locations" ON public.places;
DROP POLICY IF EXISTS "Admins can delete locations" ON public.places;

-- brands
DROP POLICY IF EXISTS "Contributors and admins can insert brands" ON public.brands;

-- submissions
DROP POLICY IF EXISTS "Admins can view all submissions" ON public.submissions;
DROP POLICY IF EXISTS "Contributors and admins can insert submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admins can update submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admins can delete submissions" ON public.submissions;

-- Remove old CHECK constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Remove old role column
ALTER TABLE public.users DROP COLUMN role;

------------------------------------------------------------

-- ============================================
-- 6. Recreate Policies Using New Role System
-- ============================================

-- submission_images
CREATE POLICY "users_read_submission_images"
ON public.submission_images FOR SELECT
USING (
    public.is_admin()
    OR EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.id = submission_images.submission_id
        AND s.user_id = auth.uid()
    )
);

CREATE POLICY "Admin update submission images"
ON public.submission_images FOR UPDATE
USING (public.is_admin());

CREATE POLICY "Authenticated users can read submission images"
ON public.submission_images FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can delete submission images"
ON public.submission_images FOR DELETE
USING (public.is_admin());

-- storage.objects
CREATE POLICY "admin_delete_submission_images"
ON storage.objects FOR DELETE
USING (public.is_admin());

-- locations
CREATE POLICY "Contributors and admins can insert stores"
ON public.locations FOR INSERT
WITH CHECK (public.is_contributor_or_admin());

-- places
CREATE POLICY "Admins can update locations"
ON public.places FOR UPDATE
USING (public.is_admin());

CREATE POLICY "Admins can delete locations"
ON public.places FOR DELETE
USING (public.is_admin());

-- brands
CREATE POLICY "Contributors and admins can insert brands"
ON public.brands FOR INSERT
WITH CHECK (public.is_contributor_or_admin());

-- submissions
CREATE POLICY "Admins can view all submissions"
ON public.submissions FOR SELECT
USING (public.is_admin());

CREATE POLICY "Contributors and admins can insert submissions"
ON public.submissions FOR INSERT
WITH CHECK (public.is_contributor_or_admin());

CREATE POLICY "Admins can update submissions"
ON public.submissions FOR UPDATE
USING (public.is_admin());

CREATE POLICY "Admins can delete submissions"
ON public.submissions FOR DELETE
USING (public.is_admin());
