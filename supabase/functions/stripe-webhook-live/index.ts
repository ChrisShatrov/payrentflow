/**
 * Stripe LIVE webhook endpoint. Use this URL in Stripe Dashboard for live mode webhooks.
 * - Verifies signature with STRIPE_WEBHOOK_SECRET_LIVE.
 * - Rejects test-mode events (event.livemode === false) with 400.
 * - Idempotency: insert (event_id, 'live') into stripe_webhook_events first; on conflict return 200.
 * - All payment updates use stripe_mode = 'live'.
 *
 * Requires APP_ENV=prod and STRIPE_MODE=live (validateStripeEnv enforces this).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getStripeKey, validateStripeEnv } from "../_shared/stripe-config.ts";
import { processStripeWebhookEvent } from "../_shared/stripe-webhook-handler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK-LIVE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    validateStripeEnv();
    const stripeKey = getStripeKey();
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false },
    });

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      logStep("ERROR: No stripe-signature header");
      return new Response("No signature", { status: 400, headers: corsHeaders });
    }

    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET_LIVE");
    if (!webhookSecret) {
      logStep("ERROR: STRIPE_WEBHOOK_SECRET_LIVE not configured");
      return new Response("Webhook secret not configured", { status: 500, headers: corsHeaders });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logStep("ERROR: Webhook signature verification failed", { error: msg });
      return new Response(`Webhook Error: ${msg}`, { status: 400, headers: corsHeaders });
    }

    logStep("Event received", {
      event_id: event.id,
      type: event.type,
      livemode: event.livemode,
      stripe_mode: "live",
    });

    if (event.livemode === false) {
      logStep("ERROR: Test-mode event sent to live webhook; rejecting");
      return new Response(
        JSON.stringify({ error: "Test-mode events must use stripe-webhook-test endpoint" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Idempotency: insert (event_id, 'live') first
    const { error: insertError } = await supabaseAdmin
      .from("stripe_webhook_events")
      .insert({ event_id: event.id, stripe_mode: "live" });

    if (insertError) {
      if (insertError.code === "23505") {
        logStep("Duplicate event, returning 200", { event_id: event.id, stripe_mode: "live" });
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      logStep("ERROR: Failed to insert webhook event", { error: insertError.message });
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await processStripeWebhookEvent(
      event,
      "live",
      stripe,
      supabaseAdmin,
      supabaseUrl,
      supabaseAnonKey
    );

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR: Unhandled exception", { error: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
