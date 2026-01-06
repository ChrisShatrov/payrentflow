-- First, drop the problematic policy
DROP POLICY IF EXISTS "Tenants can view their property" ON public.properties;

-- Create a security definer function to check if a tenant is assigned to a property
CREATE OR REPLACE FUNCTION public.tenant_has_access_to_property(property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.units
    WHERE units.property_id = tenant_has_access_to_property.property_id
    AND units.tenant_id = auth.uid()
  )
$$;

-- Create the new policy using the function
CREATE POLICY "Tenants can view their property" 
ON public.properties 
FOR SELECT 
USING (public.tenant_has_access_to_property(id));