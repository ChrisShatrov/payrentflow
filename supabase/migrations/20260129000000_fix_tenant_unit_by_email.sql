-- Fix: Allow tenant to see their unit when unit.tenant_id points to a profile with the same email
-- (e.g. profile/id mismatch after invite or duplicate profile). Updates unit to auth.uid() so future loads work.

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

  -- Get current user's email from their profile
  SELECT email INTO current_email
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1;

  IF current_email IS NULL OR current_email = '' THEN
    RETURN NULL;
  END IF;

  -- Find a unit whose assigned tenant (profile) has the same email
  SELECT u.id INTO unit_id_found
  FROM units u
  JOIN profiles p ON p.id = u.tenant_id
  WHERE p.email = current_email
  LIMIT 1;

  IF unit_id_found IS NULL THEN
    RETURN NULL;
  END IF;

  -- Fix the link so unit points to the logged-in user (same person, same email)
  UPDATE units
  SET tenant_id = auth.uid()
  WHERE id = unit_id_found;

  RETURN unit_id_found;
END;
$$;

COMMENT ON FUNCTION public.fix_tenant_unit_assignment_by_email() IS 'For the current user, finds a unit assigned to a profile with the same email and updates unit.tenant_id to auth.uid() so the tenant can see their unit. Returns the unit id or null.';

GRANT EXECUTE ON FUNCTION public.fix_tenant_unit_assignment_by_email() TO authenticated;
