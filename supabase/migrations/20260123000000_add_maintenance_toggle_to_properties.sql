-- Add allow_maintenance_requests column to properties table
-- This allows admins to disable maintenance requests for entire properties
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS allow_maintenance_requests BOOLEAN DEFAULT TRUE;

-- Add comment to document the column
COMMENT ON COLUMN properties.allow_maintenance_requests IS 'Controls whether tenants can submit maintenance requests for this property. Defaults to TRUE for existing properties.';
