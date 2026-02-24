-- Fix: Tenant invited and assigned a unit sees "No unit assigned" after signup.
-- Cause: Invite stores profile email (e.g. lowercase); signup may use different casing.
-- Use case-insensitive email matching so the trigger and fix RPC find the same-email profile/unit.

-- 1) handle_new_user: find existing profile by email (case-insensitive) so we can repoint units to NEW.id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_profile_id UUID;
BEGIN
  -- Check if a profile with this email already exists (created by admin/invite)
  -- Use case-insensitive match so invite (e.g. lowercase) matches signup (any case)
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
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
    RAISE WARNING 'Profile creation failed for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2) fix_tenant_unit_assignment_by_email: match by email case-insensitively; get email from profile or auth.users
CREATE OR REPLACE FUNCTION public.fix_tenant_unit_assignment_by_email()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_email TEXT;
  unit_id_found UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get current user's email from profile first
  SELECT TRIM(email) INTO current_email
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1;

  -- Fallback: get from auth.users (canonical source) if profile email is missing
  IF current_email IS NULL OR current_email = '' THEN
    SELECT TRIM(email) INTO current_email
    FROM auth.users
    WHERE id = auth.uid()
    LIMIT 1;
  END IF;

  IF current_email IS NULL OR current_email = '' THEN
    RETURN NULL;
  END IF;

  -- Find a unit whose assigned tenant (profile) has the same email (case-insensitive)
  SELECT u.id INTO unit_id_found
  FROM units u
  JOIN profiles p ON p.id = u.tenant_id
  WHERE LOWER(TRIM(p.email)) = LOWER(current_email)
  LIMIT 1;

  IF unit_id_found IS NULL THEN
    RETURN NULL;
  END IF;

  -- Fix the link so unit points to the logged-in user
  UPDATE units
  SET tenant_id = auth.uid()
  WHERE id = unit_id_found;

  RETURN unit_id_found;
END;
$$;

COMMENT ON FUNCTION public.fix_tenant_unit_assignment_by_email() IS 'For the current user, finds a unit assigned to a profile with the same email (case-insensitive) and updates unit.tenant_id to auth.uid(). Uses profile or auth.users for email.';

-- 3) Optional: fix by explicit email (dashboard can pass user.email when no-arg RPC returns null)
CREATE OR REPLACE FUNCTION public.fix_tenant_unit_assignment_by_email_with_email(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  unit_id_found UUID;
BEGIN
  IF auth.uid() IS NULL OR p_email IS NULL OR TRIM(p_email) = '' THEN
    RETURN NULL;
  END IF;

  -- Find a unit whose assigned tenant (profile) has this email (case-insensitive)
  SELECT u.id INTO unit_id_found
  FROM units u
  JOIN profiles p ON p.id = u.tenant_id
  WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(p_email))
  LIMIT 1;

  IF unit_id_found IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE units
  SET tenant_id = auth.uid()
  WHERE id = unit_id_found;

  RETURN unit_id_found;
END;
$$;

COMMENT ON FUNCTION public.fix_tenant_unit_assignment_by_email_with_email(TEXT) IS 'Same as fix_tenant_unit_assignment_by_email but takes email as argument. Call with user.email when the no-arg RPC returns null.';

GRANT EXECUTE ON FUNCTION public.fix_tenant_unit_assignment_by_email_with_email(TEXT) TO authenticated;
