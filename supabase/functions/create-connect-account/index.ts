import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getStripeKey } from "../_shared/stripe-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CONNECT-ACCOUNT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = getStripeKey();
    logStep("Stripe key verified", { mode: stripeKey.startsWith("sk_test_") ? "test" : "prod" });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    logStep("Authorization header check", { hasHeader: !!authHeader, headerLength: authHeader?.length || 0 });
    
    if (!authHeader) {
      logStep("ERROR: No authorization header provided");
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    logStep("Token extracted", { tokenLength: token.length, tokenPrefix: token.substring(0, 20) + "..." });
    
    if (!token || token.length === 0) {
      logStep("ERROR: Empty token after Bearer removal");
      throw new Error("Invalid authorization token");
    }

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      logStep("ERROR: getUser failed", { error: userError.message });
      throw new Error(`Authentication error: ${userError.message}`);
    }
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check if user already has a Stripe Connect account
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("stripe_account_id, role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      throw new Error("Only landlords can create Stripe Connect accounts");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let accountId = profile?.stripe_account_id;

    if (!accountId) {
      // Create new Stripe Connect account
      logStep("Creating new Stripe Connect account");
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
          us_bank_account_ach_payments: { requested: true },
        },
        business_type: "individual",
      });
      accountId = account.id;
      logStep("Stripe Connect account created", { accountId });

      // Save account ID to profile
      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", user.id);

      if (updateError) {
        logStep("Error saving account ID", { error: updateError.message });
        throw new Error("Failed to save Stripe account");
      }
      logStep("Account ID saved to profile");
    }

    // Create account link for onboarding
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/admin?stripe_refresh=true`,
      return_url: `${origin}/admin?stripe_success=true`,
      type: "account_onboarding",
    });
    logStep("Account link created", { url: accountLink.url });

    return new Response(JSON.stringify({ 
      url: accountLink.url,
      account_id: accountId 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
