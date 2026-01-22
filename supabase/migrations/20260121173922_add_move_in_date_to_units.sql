-- Add move_in_date column to units table
-- This date is used to calculate pro-rated rent for the first month and prevent statement generation before move-in
ALTER TABLE public.units 
ADD COLUMN move_in_date DATE;

COMMENT ON COLUMN public.units.move_in_date IS 'The date when the tenant moves into the unit. Used to calculate pro-rated rent for the first month and prevent statement generation before move-in.';
