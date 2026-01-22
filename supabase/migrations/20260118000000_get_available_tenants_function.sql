-- Create a function to get all assigned tenant IDs (bypasses RLS to see all units)
-- This is needed because RLS prevents landlords from seeing units from other landlords' properties
CREATE OR REPLACE FUNCTION get_all_assigned_tenant_ids()
RETURNS TABLE (
  tenant_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT u.tenant_id
  FROM public.units u
  WHERE u.tenant_id IS NOT NULL;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_all_assigned_tenant_ids() TO authenticated;

-- Create a function to get available tenants (confirmed email, no unit assigned)
-- This function checks auth.users for email confirmation status
-- Shows ALL tenants that don't have ANY unit assigned (across all landlords)
CREATE OR REPLACE FUNCTION get_available_tenants(landlord_id_param UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_tenant_ids UUID[];
BEGIN
  -- Get all assigned tenant IDs using the helper function (bypasses RLS)
  SELECT ARRAY_AGG(tenant_id) INTO assigned_tenant_ids
  FROM get_all_assigned_tenant_ids();

  RETURN QUERY
  SELECT DISTINCT
    p.id,
    p.full_name,
    p.email
  FROM public.profiles p
  INNER JOIN auth.users u ON p.id = u.id
  WHERE 
    p.role = 'tenant'
    AND u.email_confirmed_at IS NOT NULL
    AND (assigned_tenant_ids IS NULL OR p.id != ALL(assigned_tenant_ids))
  ORDER BY p.full_name NULLS LAST, p.email;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_available_tenants(UUID) TO authenticated;
