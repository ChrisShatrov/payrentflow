-- Fix payments status constraint to allow 'completed' status
-- The constraint currently only allows 'paid', 'failed', 'pending'
-- But the code uses 'completed' for successful payments

-- Drop the old constraint
ALTER TABLE payments 
DROP CONSTRAINT IF EXISTS payments_status_check;

-- Add the new constraint that includes 'completed'
ALTER TABLE payments 
ADD CONSTRAINT payments_status_check 
CHECK (status IN ('paid', 'failed', 'pending', 'completed'));
