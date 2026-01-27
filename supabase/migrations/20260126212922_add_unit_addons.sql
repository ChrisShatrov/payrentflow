-- Add addons column to units table
-- This stores an array of addon objects with name and price
-- Format: [{"name": "Garage", "price": 50.00}, {"name": "Parking spot", "price": 25.00}, ...]
ALTER TABLE public.units 
ADD COLUMN IF NOT EXISTS addons JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.units.addons IS 'Array of addon objects with name and price. Format: [{"name": "Garage", "price": 50.00}, ...]. Valid addon names: "Garage", "Parking spot", "Covered parking spot", "Utilities", "Internet"';
