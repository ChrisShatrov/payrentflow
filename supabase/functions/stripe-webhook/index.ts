import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const FAILED_ACH_FEE = 1000; // $10.00 in cents

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      logStep("ERROR: No stripe-signature header");
      return new Response("No signature", { status: 400 });
    }

    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      logStep("ERROR: STRIPE_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStep("ERROR: Webhook signature verification failed", { error: errorMessage });
      return new Response(`Webhook Error: ${errorMessage}`, { status: 400 });
    }

    logStep("Event received", { type: event.type, id: event.id });

    // Handle ACH payment failure events
    if (
      event.type === "payment_intent.payment_failed" ||
      event.type === "charge.failed"
    ) {
      const paymentIntent = event.type === "payment_intent.payment_failed"
        ? (event.data.object as Stripe.PaymentIntent)
        : null;
      const charge = event.type === "charge.failed"
        ? (event.data.object as Stripe.Charge)
        : null;

      const stripePaymentId = paymentIntent?.id || charge?.payment_intent;
      const paymentMethodType = paymentIntent?.payment_method_types?.[0] ||
        charge?.payment_method_details?.type;

      logStep("Payment failure detected", {
        stripePaymentId,
        paymentMethodType,
        eventType: event.type,
      });

      // Only process ACH bank transfers
      if (paymentMethodType !== "us_bank_account" && paymentMethodType !== "ach_debit") {
        logStep("Not an ACH payment, skipping", { paymentMethodType });
        return new Response(JSON.stringify({ received: true, action: "skipped_non_ach" }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      if (!stripePaymentId) {
        logStep("ERROR: No payment ID found");
        return new Response(JSON.stringify({ received: true, error: "no_payment_id" }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Find the payment in our database
      const { data: payment, error: paymentError } = await supabaseAdmin
        .from("payments")
        .select("*, statements(*)")
        .eq("stripe_payment_id", stripePaymentId)
        .single();

      if (paymentError || !payment) {
        logStep("Payment not found in database", { stripePaymentId, error: paymentError?.message });
        return new Response(JSON.stringify({ received: true, error: "payment_not_found" }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      logStep("Found payment in database", { paymentId: payment.id, currentStatus: payment.status });

      // IDEMPOTENCY CHECK: Skip if fee already applied
      if (payment.failed_ach_fee_applied === true) {
        logStep("Fee already applied, skipping (idempotent)", { paymentId: payment.id });
        return new Response(JSON.stringify({ received: true, action: "already_processed" }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Mark payment as failed and set the idempotency flag atomically
      const { error: updatePaymentError } = await supabaseAdmin
        .from("payments")
        .update({
          status: "failed",
          failed_at: new Date().toISOString(),
          failed_ach_fee_applied: true, // Set flag BEFORE adding fee to prevent race conditions
        })
        .eq("id", payment.id)
        .eq("failed_ach_fee_applied", false); // Only update if flag is still false (optimistic lock)

      if (updatePaymentError) {
        logStep("ERROR: Failed to update payment", { error: updatePaymentError.message });
        return new Response(JSON.stringify({ received: true, error: "update_failed" }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Add $10 failed ACH fee to the statement's additional_fees
      if (payment.statement_id) {
        const currentAdditionalFees = payment.statements?.additional_fees || 0;
        const newAdditionalFees = currentAdditionalFees + FAILED_ACH_FEE;

        // Get current statement to recalculate total
        const { data: statement, error: statementFetchError } = await supabaseAdmin
          .from("statements")
          .select("*")
          .eq("id", payment.statement_id)
          .single();

        if (statementFetchError || !statement) {
          logStep("ERROR: Failed to fetch statement", { error: statementFetchError?.message });
        } else {
          const newTotalDue = statement.base_rent + (statement.late_fee || 0) + newAdditionalFees;

          const { error: updateStatementError } = await supabaseAdmin
            .from("statements")
            .update({
              additional_fees: newAdditionalFees,
              total_due: newTotalDue,
              status: "unpaid", // Reset to unpaid since payment failed
            })
            .eq("id", payment.statement_id);

          if (updateStatementError) {
            logStep("ERROR: Failed to update statement", { error: updateStatementError.message });
          } else {
            logStep("Successfully applied $10 failed ACH fee", {
              paymentId: payment.id,
              statementId: payment.statement_id,
              previousAdditionalFees: currentAdditionalFees,
              newAdditionalFees,
              newTotalDue,
            });
          }
        }
      } else {
        logStep("No statement linked to payment", { paymentId: payment.id });
      }

      return new Response(JSON.stringify({ received: true, action: "fee_applied" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Handle successful payment (mark statement as paid)
    if (event.type === "payment_intent.succeeded" || event.type === "charge.succeeded") {
      const paymentIntent = event.type === "payment_intent.succeeded"
        ? (event.data.object as Stripe.PaymentIntent)
        : null;
      const charge = event.type === "charge.succeeded"
        ? (event.data.object as Stripe.Charge)
        : null;

      const stripePaymentId = paymentIntent?.id || charge?.payment_intent;

      if (stripePaymentId) {
        logStep("Payment succeeded", { stripePaymentId });

        // Find and update the payment
        const { data: payment, error: paymentError } = await supabaseAdmin
          .from("payments")
          .select("*")
          .eq("stripe_payment_id", stripePaymentId)
          .single();

        if (payment && !paymentError) {
          await supabaseAdmin
            .from("payments")
            .update({
              status: "completed",
              paid_at: new Date().toISOString(),
            })
            .eq("id", payment.id);

          // Mark statement as paid
          if (payment.statement_id) {
            await supabaseAdmin
              .from("statements")
              .update({ status: "paid" })
              .eq("id", payment.statement_id);

            logStep("Payment and statement marked as paid", {
              paymentId: payment.id,
              statementId: payment.statement_id,
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR: Unhandled exception", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
