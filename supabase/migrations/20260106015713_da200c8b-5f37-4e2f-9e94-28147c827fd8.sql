-- Add lease_pdf_url column to units table
ALTER TABLE public.units ADD COLUMN lease_pdf_url text;

-- Create storage bucket for lease documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('leases', 'leases', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for leases bucket
-- Landlords can upload leases to their properties
CREATE POLICY "Landlords can upload leases"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'leases' AND
  EXISTS (
    SELECT 1 FROM units u
    JOIN properties p ON p.id = u.property_id
    WHERE p.landlord_id = auth.uid()
    AND (storage.foldername(name))[1] = u.id::text
  )
);

-- Landlords can update leases for their properties
CREATE POLICY "Landlords can update leases"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'leases' AND
  EXISTS (
    SELECT 1 FROM units u
    JOIN properties p ON p.id = u.property_id
    WHERE p.landlord_id = auth.uid()
    AND (storage.foldername(name))[1] = u.id::text
  )
);

-- Landlords can delete leases for their properties
CREATE POLICY "Landlords can delete leases"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'leases' AND
  EXISTS (
    SELECT 1 FROM units u
    JOIN properties p ON p.id = u.property_id
    WHERE p.landlord_id = auth.uid()
    AND (storage.foldername(name))[1] = u.id::text
  )
);

-- Landlords can view leases for their properties
CREATE POLICY "Landlords can view leases"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'leases' AND
  EXISTS (
    SELECT 1 FROM units u
    JOIN properties p ON p.id = u.property_id
    WHERE p.landlord_id = auth.uid()
    AND (storage.foldername(name))[1] = u.id::text
  )
);

-- Tenants can view their own lease
CREATE POLICY "Tenants can view own lease"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'leases' AND
  EXISTS (
    SELECT 1 FROM units u
    WHERE u.tenant_id = auth.uid()
    AND (storage.foldername(name))[1] = u.id::text
  )
);