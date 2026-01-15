-- Add split_payment_fee column to units table
ALTER TABLE public.units 
ADD COLUMN split_payment_fee NUMERIC(10, 2) DEFAULT 30.00;
