-- Robust profile creation trigger that handles all edge cases
-- This ensures profiles are ALWAYS created when users sign up
-- Prevents the issue where tenants can't see their assigned units

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_profile_id UUID;
BEGIN
  -- Check if a profile with this email already exists (created by admin/invite)
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE email = NEW.email
  LIMIT 1;

  -- If profile exists with different ID, migrate it
  IF existing_profile_id IS NOT NULL AND existing_profile_id != NEW.id THEN
    -- Update any units linked to the old profile
    UPDATE units
    SET tenant_id = NEW.id
    WHERE tenant_id = existing_profile_id;

    -- Delete the old profile (this releases the email constraint)
    DELETE FROM public.profiles
    WHERE id = existing_profile_id;
  END IF;

  -- Now insert the new profile (no conflicts possible)
  -- Use ON CONFLICT to handle race conditions
  INSERT INTO public.profiles (id, email, full_name, role, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'tenant'),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    role = COALESCE(EXCLUDED.role, profiles.role),
    phone = COALESCE(EXCLUDED.phone, profiles.phone);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail auth user creation
    -- This is a last resort - the trigger should rarely fail now
    RAISE WARNING 'Profile creation failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure the INSERT policy exists (as backup)
DROP POLICY IF EXISTS "Users can create own profile" ON profiles;
CREATE POLICY "Users can create own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a profile when a new user signs up. Handles email conflicts by migrating existing profiles. Ensures profiles always exist for RLS policies to work correctly.';
