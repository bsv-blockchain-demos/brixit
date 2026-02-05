-- Update handle_new_user function to support wallet users and ensure default viewer role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert user profile (email may be null for wallet users)
  INSERT INTO public.users (id, email, created_at)
  VALUES (new.id, new.email, now())
  ON CONFLICT (id) DO UPDATE
  SET email = COALESCE(new.email, public.users.email);

  -- Ensure default 'viewer' role exists for new users
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'viewer')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user IS
'Auto-provisions user profile and default viewer role for new auth.users (email or wallet)';
