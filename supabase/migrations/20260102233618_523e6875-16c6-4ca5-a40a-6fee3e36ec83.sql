-- Add stripe_account_id column to profiles table for landlord's Stripe Connect account
ALTER TABLE public.profiles 
ADD COLUMN stripe_account_id TEXT DEFAULT NULL;

-- Add index for faster lookups
CREATE INDEX idx_profiles_stripe_account_id ON public.profiles(stripe_account_id) WHERE stripe_account_id IS NOT NULL;