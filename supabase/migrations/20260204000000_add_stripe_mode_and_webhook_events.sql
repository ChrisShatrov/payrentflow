-- Option B: Tag payments and webhook events with stripe_mode so test/live never mix in one Supabase project.
-- Payments: add stripe_mode (test | live).
-- Webhook idempotency: store (event_id, stripe_mode) so test and live events are tracked separately.

-- 1) Add stripe_mode to payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_mode TEXT NOT NULL DEFAULT 'test'
  CHECK (stripe_mode IN ('test', 'live'));

COMMENT ON COLUMN public.payments.stripe_mode IS 'Stripe mode when this payment was created (test or live). Webhook updates must match this mode.';

-- Index for webhook lookups: by stripe_payment_id + stripe_mode
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_id_mode
  ON public.payments (stripe_payment_id, stripe_mode)
  WHERE stripe_payment_id IS NOT NULL;

-- 2) Webhook events table: idempotency per (event_id, stripe_mode)
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id   TEXT NOT NULL,
  stripe_mode TEXT NOT NULL CHECK (stripe_mode IN ('test', 'live')),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, stripe_mode)
);

COMMENT ON TABLE public.stripe_webhook_events IS 'Stripe webhook event idempotency: one row per (event_id, stripe_mode). Insert before processing; conflict means duplicate.';

-- RLS: only service role should access (Edge Functions use service role)
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for stripe_webhook_events"
  ON public.stripe_webhook_events
  FOR ALL
  USING (true)
  WITH CHECK (true);
