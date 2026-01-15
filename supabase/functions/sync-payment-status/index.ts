import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");

    const { payment_id } = await req.json();
    if (!payment_id) {
      throw new Error("payment_id is required");
    }

    console.log(`[SYNC-PAYMENT-STATUS] Syncing payment ${payment_id} for user ${user.id}`);

    // Get the payment record
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select(`
        *,
        units!inner(tenant_id)
      `)
      .eq("id", payment_id)
      .single();

    if (paymentError || !payment) {
      throw new Error(`Payment not found: ${paymentError?.message}`);
    }

    // Verify user owns this payment
    const unit = payment.units as any;
    if (unit.tenant_id !== user.id) {
      throw new Error("Unauthorized: You can only sync your own payments");
    }

    if (!payment.stripe_payment_id) {
      throw new Error("Payment has no Stripe payment ID");
    }

    // Check if it's a session ID or payment intent ID
    const stripeId = payment.stripe_payment_id;
    let session: Stripe.Checkout.Session | null = null;
    let paymentIntent: Stripe.PaymentIntent | null = null;

    // Try to retrieve as checkout session first
    try {
      session = await stripe.checkout.sessions.retrieve(stripeId);
      console.log(`[SYNC-PAYMENT-STATUS] Found checkout session: ${session.id}, status: ${session.payment_status}`);
    } catch (e) {
      // Not a session, try as payment intent
      try {
        paymentIntent = await stripe.paymentIntents.retrieve(stripeId);
        console.log(`[SYNC-PAYMENT-STATUS] Found payment intent: ${paymentIntent.id}, status: ${paymentIntent.status}`);
      } catch (e2) {
        throw new Error(`Could not find Stripe payment with ID: ${stripeId}`);
      }
    }

    // Determine payment status
    let newStatus = payment.status;
    let paidAt = payment.paid_at;

    if (session) {
      console.log(`[SYNC-PAYMENT-STATUS] Session details:`, {
        id: session.id,
        payment_status: session.payment_status,
        status: session.status,
        payment_intent: session.payment_intent,
      });
      
      // Check if payment is paid - session.status can be "complete" or "open"
      // payment_status can be "paid", "unpaid", or "no_payment_required"
      if (session.payment_status === "paid") {
        newStatus = "completed";
        // Get paid_at from payment intent if available
        if (!paidAt && session.payment_intent) {
          try {
            const pi = await stripe.paymentIntents.retrieve(
              typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id
            );
            // Use the payment intent's created time or latest charge time
            if (pi.latest_charge) {
              const charge = await stripe.charges.retrieve(
                typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge.id
              );
              paidAt = new Date(charge.created * 1000).toISOString();
            } else {
              paidAt = new Date(pi.created * 1000).toISOString();
            }
          } catch (e) {
            console.error(`[SYNC-PAYMENT-STATUS] Error getting payment intent:`, e);
            paidAt = new Date().toISOString();
          }
        } else if (!paidAt) {
          paidAt = new Date().toISOString();
        }
      } else if (session.payment_status === "unpaid" && session.status === "expired") {
        newStatus = "failed";
      } else if (session.payment_status === "unpaid") {
        newStatus = "pending";
      }
    } else if (paymentIntent) {
      if (paymentIntent.status === "succeeded") {
        newStatus = "completed";
        if (!paidAt) {
          paidAt = new Date(paymentIntent.created * 1000).toISOString();
        }
      } else if (paymentIntent.status === "requires_payment_method" || paymentIntent.status === "canceled") {
        newStatus = "failed";
      }
    }

    // Update payment if status changed
    if (newStatus !== payment.status) {
      console.log(`[SYNC-PAYMENT-STATUS] Updating payment status from ${payment.status} to ${newStatus}`);
      
      const updateData: any = { status: newStatus };
      if (newStatus === "completed" && !paidAt) {
        updateData.paid_at = new Date().toISOString();
      } else if (paidAt) {
        updateData.paid_at = paidAt;
      }

      const { error: updateError } = await supabaseAdmin
        .from("payments")
        .update(updateData)
        .eq("id", payment_id);

      if (updateError) {
        throw new Error(`Failed to update payment: ${updateError.message}`);
      }

      // Update statement status if payment is completed
      if (newStatus === "completed" && payment.statement_id) {
        const { error: updateStatementError } = await supabaseAdmin
          .from("statements")
          .update({ status: "paid" })
          .eq("id", payment.statement_id);
        
        if (updateStatementError) {
          console.error(`[SYNC-PAYMENT-STATUS] Error updating statement status:`, updateStatementError);
        } else {
          console.log(`[SYNC-PAYMENT-STATUS] Statement status updated to paid`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Payment status synced",
          oldStatus: payment.status,
          newStatus,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Payment status is already up to date",
          status: payment.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("[SYNC-PAYMENT-STATUS] Error:", {
      message: errorMessage,
      stack: errorStack,
      error: String(error),
    });
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorStack,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
