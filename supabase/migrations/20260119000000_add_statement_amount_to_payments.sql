-- Add column to track the amount applied to the statement (for split payments)
-- This is the portion of the payment that goes towards the current statement
-- For full payments, this equals (amount - fee_amount)
-- For split payments, this is the payment_amount (amount towards current month)
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS statement_amount NUMERIC(10, 2);

-- Add comment explaining the purpose
COMMENT ON COLUMN public.payments.statement_amount IS 'Amount of this payment that was applied to the statement. For split payments, this is the payment_amount (portion towards current month). For full payments, this equals (amount - fee_amount).';

-- For existing payments, set statement_amount to (amount - fee_amount) as a best estimate
UPDATE public.payments
SET statement_amount = amount - COALESCE(fee_amount, 0)
WHERE statement_amount IS NULL;
