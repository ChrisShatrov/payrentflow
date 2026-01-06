-- Drop existing policies for leases bucket
DROP POLICY IF EXISTS "Landlords can upload leases" ON storage.objects;
DROP POLICY IF EXISTS "Landlords can update leases" ON storage.objects;
DROP POLICY IF EXISTS "Landlords can delete leases" ON storage.objects;
DROP POLICY IF EXISTS "Landlords can view leases" ON storage.objects;
DROP POLICY IF EXISTS "Tenants can view own lease" ON storage.objects;

-- Create simpler policies using the unit id as folder name
-- Landlords can upload leases to their units
CREATE POLICY "Landlords can upload leases"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'leases' AND
  EXISTS (
    SELECT 1 FROM public.units u
    JOIN public.properties p ON p.id = u.property_id
    WHERE p.landlord_id = auth.uid()
    AND u.id::text = (string_to_array(name, '/'))[1]
  )
);

-- Landlords can update leases for their units
CREATE POLICY "Landlords can update leases"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'leases' AND
  EXISTS (
    SELECT 1 FROM public.units u
    JOIN public.properties p ON p.id = u.property_id
    WHERE p.landlord_id = auth.uid()
    AND u.id::text = (string_to_array(name, '/'))[1]
  )
);

-- Landlords can delete leases for their units
CREATE POLICY "Landlords can delete leases"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'leases' AND
  EXISTS (
    SELECT 1 FROM public.units u
    JOIN public.properties p ON p.id = u.property_id
    WHERE p.landlord_id = auth.uid()
    AND u.id::text = (string_to_array(name, '/'))[1]
  )
);

-- Landlords can view leases for their units
CREATE POLICY "Landlords can view leases"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'leases' AND
  EXISTS (
    SELECT 1 FROM public.units u
    JOIN public.properties p ON p.id = u.property_id
    WHERE p.landlord_id = auth.uid()
    AND u.id::text = (string_to_array(name, '/'))[1]
  )
);

-- Tenants can view their own lease
CREATE POLICY "Tenants can view own lease"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'leases' AND
  EXISTS (
    SELECT 1 FROM public.units u
    WHERE u.tenant_id = auth.uid()
    AND u.id::text = (string_to_array(name, '/'))[1]
  )
);