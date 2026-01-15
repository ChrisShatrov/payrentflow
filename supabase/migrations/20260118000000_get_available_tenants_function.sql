-- Create a function to get available tenants (confirmed email, no unit assigned)
-- This function checks auth.users for email confirmation status
CREATE OR REPLACE FUNCTION get_available_tenants()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.email
  FROM public.profiles p
  INNER JOIN auth.users u ON p.id = u.id
  WHERE 
    p.role = 'tenant'
    AND u.email_confirmed_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 
      FROM public.units 
      WHERE tenant_id = p.id
    )
  ORDER BY p.full_name NULLS LAST, p.email;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_available_tenants() TO authenticated;
