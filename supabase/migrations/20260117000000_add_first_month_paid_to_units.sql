-- Add first_month_paid column to units table
-- This indicates that the tenant's first month has been paid and they are not responsible for the current month
ALTER TABLE public.units 
ADD COLUMN first_month_paid BOOLEAN DEFAULT FALSE;

-- Add comment to explain the column
COMMENT ON COLUMN public.units.first_month_paid IS 'Indicates if the tenant has paid their first month. When true, the tenant is not responsible for the current month when statements are generated.';
