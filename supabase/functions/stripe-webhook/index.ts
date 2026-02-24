/**
 * DEPRECATED: Single Stripe webhook endpoint is no longer used.
 * Use mode-specific endpoints so test and live never mix in the same Supabase project:
 *
 * - Stripe TEST mode → /functions/v1/stripe-webhook-test  (STRIPE_WEBHOOK_SECRET_TEST)
 * - Stripe LIVE mode → /functions/v1/stripe-webhook-live (STRIPE_WEBHOOK_SECRET_LIVE)
 *
 * Configure these URLs in your Stripe Dashboard (Developers → Webhooks).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const body = JSON.stringify({
    error: "deprecated",
    message:
      "Use stripe-webhook-test for test mode and stripe-webhook-live for live mode. " +
      "See README for Stripe Dashboard webhook URLs and secrets (STRIPE_WEBHOOK_SECRET_TEST, STRIPE_WEBHOOK_SECRET_LIVE).",
    endpoints: {
      test: "/functions/v1/stripe-webhook-test",
      live: "/functions/v1/stripe-webhook-live",
    },
  });

  return new Response(body, {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
