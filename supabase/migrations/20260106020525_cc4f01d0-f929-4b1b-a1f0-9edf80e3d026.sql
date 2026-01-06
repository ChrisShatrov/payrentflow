-- Create security definer function to check if landlord owns a unit
CREATE OR REPLACE FUNCTION public.landlord_owns_unit(unit_id_text text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.units u
    JOIN public.properties p ON p.id = u.property_id
    WHERE u.id::text = unit_id_text
    AND p.landlord_id = auth.uid()
  )
$$;

-- Create security definer function to check if tenant is assigned to a unit
CREATE OR REPLACE FUNCTION public.tenant_assigned_to_unit(unit_id_text text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.units u
    WHERE u.id::text = unit_id_text
    AND u.tenant_id = auth.uid()
  )
$$;

-- Drop existing policies for leases bucket
DROP POLICY IF EXISTS "Landlords can upload leases" ON storage.objects;
DROP POLICY IF EXISTS "Landlords can update leases" ON storage.objects;
DROP POLICY IF EXISTS "Landlords can delete leases" ON storage.objects;
DROP POLICY IF EXISTS "Landlords can view leases" ON storage.objects;
DROP POLICY IF EXISTS "Tenants can view own lease" ON storage.objects;

-- Recreate policies using security definer functions
CREATE POLICY "Landlords can upload leases"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'leases' AND
  public.landlord_owns_unit((string_to_array(name, '/'))[1])
);

CREATE POLICY "Landlords can update leases"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'leases' AND
  public.landlord_owns_unit((string_to_array(name, '/'))[1])
);

CREATE POLICY "Landlords can delete leases"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'leases' AND
  public.landlord_owns_unit((string_to_array(name, '/'))[1])
);

CREATE POLICY "Landlords can view leases"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'leases' AND
  public.landlord_owns_unit((string_to_array(name, '/'))[1])
);

CREATE POLICY "Tenants can view own lease"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'leases' AND
  public.tenant_assigned_to_unit((string_to_array(name, '/'))[1])
);