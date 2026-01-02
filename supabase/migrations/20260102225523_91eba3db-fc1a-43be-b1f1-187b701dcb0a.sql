-- Add daily late fee column to units table
ALTER TABLE public.units 
ADD COLUMN daily_late_fee numeric NOT NULL DEFAULT 0;