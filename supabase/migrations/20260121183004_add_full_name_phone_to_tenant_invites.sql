-- Add full_name and phone columns to tenant_invites table
ALTER TABLE public.tenant_invites 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.tenant_invites.full_name IS 'Full name of the tenant as entered by the landlord during invitation. Pre-filled and non-editable during signup.';
COMMENT ON COLUMN public.tenant_invites.phone IS 'Phone number of the tenant as entered by the landlord during invitation. Pre-filled and non-editable during signup.';
