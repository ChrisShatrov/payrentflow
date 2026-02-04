-- Landlord-side sync: set unit.tenant_id to the correct tenant profile.
-- Prefer p_tenant_id (selected in form); otherwise look up by p_tenant_email.
-- Fixes the case where unit.tenant_id pointed to an old profile that was replaced (e.g. after tenant signup).

CREATE OR REPLACE FUNCTION public.sync_unit_tenant_to_profile_by_email(
  p_unit_id UUID,
  p_tenant_email TEXT DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id_to_set UUID;
  is_landlord BOOLEAN;
BEGIN
  IF p_unit_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Caller must be the landlord of this unit
  SELECT EXISTS (
    SELECT 1 FROM units u
    JOIN properties p ON p.id = u.property_id
    WHERE u.id = p_unit_id AND p.landlord_id = auth.uid()
  ) INTO is_landlord;

  IF NOT is_landlord THEN
    RETURN FALSE;
  END IF;

  -- Prefer direct tenant id from form (most reliable)
  IF p_tenant_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM profiles WHERE id = p_tenant_id AND role = 'tenant') THEN
      profile_id_to_set := p_tenant_id;
    END IF;
  END IF;

  -- Fallback: look up by email (case-insensitive, trimmed)
  IF profile_id_to_set IS NULL AND p_tenant_email IS NOT NULL AND TRIM(p_tenant_email) <> '' THEN
    SELECT id INTO profile_id_to_set
    FROM profiles
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_tenant_email))
    AND role = 'tenant'
    LIMIT 1;
  END IF;

  IF profile_id_to_set IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE units
  SET tenant_id = profile_id_to_set
  WHERE id = p_unit_id;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.sync_unit_tenant_to_profile_by_email(UUID, TEXT, UUID) IS 'Landlord only: sets unit.tenant_id to the tenant profile. Pass p_tenant_id (from form) and/or p_tenant_email. Use after saving a unit to fix dangling tenant_id (e.g. after tenant signup).';

GRANT EXECUTE ON FUNCTION public.sync_unit_tenant_to_profile_by_email(UUID, TEXT, UUID) TO authenticated;
