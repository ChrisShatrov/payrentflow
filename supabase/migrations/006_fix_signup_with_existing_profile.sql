-- Fix: Update trigger to handle email conflicts when tenant signs up
-- This handles the case where admin created a profile manually and tenant signs up later
-- The trigger now silently handles errors and lets the API route handle profile creation

-- Update the trigger function to handle email conflicts
-- IMPORTANT: This trigger will NOT fail the auth user creation if profile creation fails
-- The API route will handle profile creation as a fallback
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_profile_id UUID;
BEGIN
  -- Silently try to create profile - if it fails, the API route will handle it
  BEGIN
    -- Check if a profile with this email already exists (created by admin)
    SELECT id INTO existing_profile_id
    FROM public.profiles
    WHERE email = NEW.email
    LIMIT 1;

    IF existing_profile_id IS NOT NULL AND existing_profile_id != NEW.id THEN
      -- Profile exists with different ID - we need to migrate it
      -- First, update any units linked to the old profile
      UPDATE units
      SET tenant_id = NEW.id
      WHERE tenant_id = existing_profile_id;

      -- Delete the old profile (this will release the email constraint)
      DELETE FROM public.profiles
      WHERE id = existing_profile_id;
    END IF;

    -- Now insert the new profile (or update if ID already exists)
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
  EXCEPTION
    WHEN OTHERS THEN
      -- Silently log the error - don't fail the auth user creation
      -- The API route will handle profile creation as a fallback
      RAISE WARNING 'Profile creation failed for user %, will be handled by API route: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

