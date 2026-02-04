-- Tenant can "claim" a profile that has their email but a different id (e.g. pre-signup placeholder).
-- Call with the tenant's email (from auth). Migrates that profile to auth.uid() so the tenant can see their unit.

CREATE OR REPLACE FUNCTION public.tenant_claim_profile_by_email(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_profile_id UUID;
  old_row RECORD;
BEGIN
  IF auth.uid() IS NULL OR p_email IS NULL OR TRIM(p_email) = '' THEN
    RETURN FALSE;
  END IF;

  -- If caller already has a profile, nothing to do
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()) THEN
    RETURN TRUE;
  END IF;

  -- Find the profile that has this email (case-insensitive) and is a tenant
  SELECT id, full_name, role, phone INTO old_row
  FROM profiles
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email))
  AND role = 'tenant'
  LIMIT 1;

  old_profile_id := old_row.id;
  IF old_profile_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Same id: already correct
  IF old_profile_id = auth.uid() THEN
    RETURN TRUE;
  END IF;

  -- Migrate: point all tenant references to auth.uid(), then replace profile row
  UPDATE units SET tenant_id = auth.uid() WHERE tenant_id = old_profile_id;
  UPDATE tenant_notifications SET tenant_id = auth.uid() WHERE tenant_id = old_profile_id;
  UPDATE dismissed_notifications SET tenant_id = auth.uid() WHERE tenant_id = old_profile_id;
  UPDATE leases SET tenant_id = auth.uid() WHERE tenant_id = old_profile_id;

  DELETE FROM profiles WHERE id = old_profile_id;

  INSERT INTO public.profiles (id, email, full_name, role, phone)
  VALUES (
    auth.uid(),
    TRIM(p_email),
    COALESCE(old_row.full_name, ''),
    COALESCE(old_row.role, 'tenant'),
    old_row.phone
  );

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'tenant_claim_profile_by_email failed: %', SQLERRM;
    RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.tenant_claim_profile_by_email(TEXT) IS 'Tenant: migrates the profile with the given email to auth.uid() so the logged-in user can see their unit. Call when profile fetch returns 406/409.';

GRANT EXECUTE ON FUNCTION public.tenant_claim_profile_by_email(TEXT) TO authenticated;
