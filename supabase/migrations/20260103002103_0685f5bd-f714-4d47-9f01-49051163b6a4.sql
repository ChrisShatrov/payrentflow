-- Add column to track if failed ACH fee was applied to prevent double-charging
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS failed_ach_fee_applied boolean DEFAULT false;

-- Add column to track if the fee was already added to statement
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS failed_at timestamp with time zone;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.payments.failed_ach_fee_applied IS 'Idempotency flag: true if $10 failed ACH fee was already applied to the statement';
COMMENT ON COLUMN public.payments.failed_at IS 'Timestamp when the payment was marked as failed';