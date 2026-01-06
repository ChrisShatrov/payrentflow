-- Add RLS policy to allow tenants to view properties of units they're assigned to
CREATE POLICY "Tenants can view their property" 
ON public.properties 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM units 
    WHERE units.property_id = properties.id 
    AND units.tenant_id = auth.uid()
  )
);