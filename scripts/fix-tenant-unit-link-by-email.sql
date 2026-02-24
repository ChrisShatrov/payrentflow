-- One-off fix: point unit(s) assigned to a profile with the given email to the AUTH user with that email.
-- Use when a tenant was invited and assigned a unit but after signup they see "No unit assigned".
-- Run in Supabase Dashboard → SQL Editor (run as superuser/service so auth.users is readable).
--
-- Replace the email below with the tenant's login email (e.g. shatrovchris+tenant12@gmail.com).

DO $$
DECLARE
  v_email TEXT := 'shatrovchris+tenant12@gmail.com';  -- <-- CHANGE THIS to the tenant's email
  v_auth_user_id UUID;
  v_unit_id UUID;
  v_old_profile_id UUID;
  v_full_name TEXT;
  v_phone TEXT;
BEGIN
  -- Get the auth user id for this email
  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email))
  LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    RAISE NOTICE 'No auth user found for email: %', v_email;
    RETURN;
  END IF;

  -- Find a unit whose tenant (profile) has this email, and get the old profile's details
  SELECT u.id, p.id, p.full_name, p.phone INTO v_unit_id, v_old_profile_id, v_full_name, v_phone
  FROM units u
  JOIN profiles p ON p.id = u.tenant_id
  WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(v_email))
  LIMIT 1;

  IF v_unit_id IS NULL THEN
    RAISE NOTICE 'No unit found assigned to a profile with email: %', v_email;
    RETURN;
  END IF;

  -- units.tenant_id references profiles(id): ensure a profile exists for the auth user.
  -- If the signup trigger didn't create one, or it failed, we create it here (and remove the old profile so email is free).
  IF v_old_profile_id IS NOT NULL AND v_old_profile_id != v_auth_user_id THEN
    DELETE FROM profiles WHERE id = v_old_profile_id;
  END IF;

  INSERT INTO profiles (id, email, full_name, role, phone)
  VALUES (v_auth_user_id, TRIM(v_email), COALESCE(v_full_name, ''), 'tenant', v_phone)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    role = COALESCE(EXCLUDED.role, profiles.role),
    phone = COALESCE(EXCLUDED.phone, profiles.phone);

  -- Point the unit to the auth user
  UPDATE units
  SET tenant_id = v_auth_user_id
  WHERE id = v_unit_id;

  RAISE NOTICE 'Updated unit % to tenant_id % (auth user for %)', v_unit_id, v_auth_user_id, v_email;
END $$;
