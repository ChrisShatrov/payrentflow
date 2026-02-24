/**
 * Shared Stripe webhook event processing. All payment lookups/updates filter by stripe_mode
 * so test and live never mix in a single Supabase project.
 */
import type Stripe from "https://esm.sh/stripe@18.5.0";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export type StripeInstance = InstanceType<typeof Stripe>;

const FAILED_ACH_FEE = 1000; // $10.00 in cents

export type StripeMode = "test" | "live";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

async function sendNotificationEmail(
  supabaseUrl: string,
  supabaseAnonKey: string,
  type: string,
  tenant_id: string | null,
  landlord_id: string | null,
  data: Record<string, unknown>
) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ type, tenant_id, landlord_id, data }),
    });
    const responseText = await response.text();
    if (!response.ok) {
      logStep("Failed to send notification email", { status: response.status, error: responseText });
    }
  } catch (error) {
    logStep("Error sending notification email", { error: String(error) });
  }
}

export async function processStripeWebhookEvent(
  event: Stripe.Event,
  stripeMode: StripeMode,
  stripe: StripeInstance,
  supabaseAdmin: SupabaseClient,
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<void> {
  logStep("Processing event", {
    event_id: event.id,
    event_type: event.type,
    livemode: event.livemode,
    stripe_mode: stripeMode,
  });

  // --- payment_intent.payment_failed / charge.failed (ACH failure) ---
  if (
    event.type === "payment_intent.payment_failed" ||
    event.type === "charge.failed"
  ) {
    const paymentIntent =
      event.type === "payment_intent.payment_failed"
        ? (event.data.object as Stripe.PaymentIntent)
        : null;
    const charge =
      event.type === "charge.failed"
        ? (event.data.object as Stripe.Charge)
        : null;

    const stripePaymentId = paymentIntent?.id || charge?.payment_intent;
    const paymentMethodType =
      paymentIntent?.payment_method_types?.[0] ||
      charge?.payment_method_details?.type;

    logStep("Payment failure detected", {
      stripePaymentId,
      paymentMethodType,
      eventType: event.type,
      stripe_mode: stripeMode,
    });

    if (
      paymentMethodType !== "us_bank_account" &&
      paymentMethodType !== "ach_debit"
    ) {
      logStep("Not an ACH payment, skipping", { paymentMethodType });
      return;
    }

    if (!stripePaymentId) {
      logStep("ERROR: No payment ID found");
      return;
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select(
        `
        *,
        statements(*),
        units!inner(
          id,
          unit_number,
          tenant_id,
          property_id,
          properties!inner(id, name, landlord_id)
        )
      `
      )
      .eq("stripe_payment_id", stripePaymentId)
      .eq("stripe_mode", stripeMode)
      .single();

    if (paymentError || !payment) {
      logStep("Payment not found in database", {
        stripePaymentId,
        stripe_mode: stripeMode,
        error: paymentError?.message,
      });
      return;
    }

    if (payment.failed_ach_fee_applied === true) {
      logStep("Fee already applied, skipping (idempotent)", { paymentId: payment.id });
      return;
    }

    const { error: updatePaymentError } = await supabaseAdmin
      .from("payments")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        failed_ach_fee_applied: true,
      })
      .eq("id", payment.id)
      .eq("failed_ach_fee_applied", false)
      .eq("stripe_mode", stripeMode);

    if (updatePaymentError) {
      logStep("ERROR: Failed to update payment", { error: updatePaymentError.message });
      return;
    }

    let newTotalDue = 0;
    if (payment.statement_id) {
      const currentAdditionalFees = payment.statements?.additional_fees || 0;
      const failedAchFeeDollars = FAILED_ACH_FEE / 100;
      const newAdditionalFees = currentAdditionalFees + failedAchFeeDollars;

      const { data: statement, error: statementFetchError } = await supabaseAdmin
        .from("statements")
        .select("*")
        .eq("id", payment.statement_id)
        .single();

      if (!statementFetchError && statement) {
        newTotalDue =
          statement.base_rent + (statement.late_fee || 0) + newAdditionalFees;
        await supabaseAdmin
          .from("statements")
          .update({
            additional_fees: newAdditionalFees,
            total_due: newTotalDue,
            status: "unpaid",
          })
          .eq("id", payment.statement_id);
      }
    }

    const unit = payment.units as any;
    if (unit) {
      await sendNotificationEmail(
        supabaseUrl,
        supabaseAnonKey,
        "payment_failed",
        unit.tenant_id,
        unit.properties?.landlord_id,
        {
          amount: payment.amount,
          unit_number: unit.unit_number,
          property_name: unit.properties?.name,
          total_due: newTotalDue,
        }
      );
    }
    return;
  }

  // --- checkout.session.expired ---
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;

    logStep("Checkout session expired", { sessionId, stripe_mode: stripeMode });

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("id, status")
      .eq("stripe_payment_id", sessionId)
      .eq("stripe_mode", stripeMode)
      .eq("status", "pending")
      .maybeSingle();

    if (payment && !paymentError) {
      await supabaseAdmin
        .from("payments")
        .update({ status: "failed" })
        .eq("id", payment.id)
        .eq("stripe_mode", stripeMode);
      logStep("Expired payment marked as failed", { paymentId: payment.id });
    }
    return;
  }

  // --- checkout.session.completed ---
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;

    logStep("Checkout session completed", {
      sessionId,
      payment_status: session.payment_status,
      stripe_mode: stripeMode,
    });

    if (session.payment_status !== "paid") {
      logStep("Checkout session completed but payment not paid", {
        sessionId,
        payment_status: session.payment_status,
      });
      return;
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select(
        `
        *,
        statements(period_month),
        units!inner(
          id,
          unit_number,
          tenant_id,
          property_id,
          properties!inner(id, name, landlord_id)
        )
      `
      )
      .eq("stripe_payment_id", sessionId)
      .eq("stripe_mode", stripeMode)
      .single();

    if (payment && !paymentError) {
      logStep("Payment found for session", {
        paymentId: payment.id,
        currentStatus: payment.status,
        sessionId,
        stripe_mode: stripeMode,
      });

      if (payment.status !== "completed") {
        await supabaseAdmin
          .from("payments")
          .update({
            status: "completed",
            paid_at: new Date().toISOString(),
          })
          .eq("id", payment.id)
          .eq("stripe_mode", stripeMode);

        if (payment.statement_id) {
          await supabaseAdmin
            .from("statements")
            .update({ status: "paid" })
            .eq("id", payment.statement_id);
        }

        const unit = payment.units as any;
        const statement = payment.statements as any;
        if (unit) {
          await sendNotificationEmail(
            supabaseUrl,
            supabaseAnonKey,
            "payment_success",
            unit.tenant_id,
            unit.properties?.landlord_id,
            {
              amount: payment.amount,
              unit_number: unit.unit_number,
              property_name: unit.properties?.name,
              period_month: statement?.period_month,
            }
          );
        }
      } else {
        logStep("Payment already marked as completed (idempotent)", {
          paymentId: payment.id,
        });
      }
    } else {
      logStep("Payment not found for session", {
        sessionId,
        stripe_mode: stripeMode,
        error: paymentError?.message,
      });
    }
    return;
  }

  // --- payment_intent.succeeded / charge.succeeded ---
  if (
    event.type === "payment_intent.succeeded" ||
    event.type === "charge.succeeded"
  ) {
    const paymentIntent =
      event.type === "payment_intent.succeeded"
        ? (event.data.object as Stripe.PaymentIntent)
        : null;
    const charge =
      event.type === "charge.succeeded"
        ? (event.data.object as Stripe.Charge)
        : null;

    const paymentIntentId = paymentIntent?.id || charge?.payment_intent;

    if (!paymentIntentId) return;

    logStep("Payment intent succeeded", {
      paymentIntentId,
      stripe_mode: stripeMode,
    });

    let payment: any = null;
    let paymentError: any = null;

    let result = await supabaseAdmin
      .from("payments")
      .select(
        `
        *,
        statements(period_month),
        units!inner(
          id,
          unit_number,
          tenant_id,
          property_id,
          properties!inner(id, name, landlord_id)
        )
      `
      )
      .eq("stripe_payment_id", paymentIntentId)
      .eq("stripe_mode", stripeMode)
      .single();

    payment = result.data;
    paymentError = result.error;

    if (paymentError && paymentIntent) {
      try {
        const full = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ["latest_charge.payment_method"],
        });
        const sessionId =
          full.metadata?.session_id ||
          (await stripe.checkout.sessions.list({
            payment_intent: paymentIntentId,
            limit: 1,
          })).data[0]?.id;

        if (sessionId) {
          result = await supabaseAdmin
            .from("payments")
            .select(
              `
              *,
              statements(period_month),
              units!inner(
                id,
                unit_number,
                tenant_id,
                property_id,
                properties!inner(id, name, landlord_id)
              )
            `
            )
            .eq("stripe_payment_id", sessionId)
            .eq("stripe_mode", stripeMode)
            .single();
          payment = result.data;
          paymentError = result.error;
        }
      } catch (_) {
        // ignore
      }
    }

    if (payment && !paymentError) {
      logStep("Payment found for payment intent", {
        paymentId: payment.id,
        currentStatus: payment.status,
        paymentIntentId,
        stripe_mode: stripeMode,
      });

      if (payment.status !== "completed") {
        await supabaseAdmin
          .from("payments")
          .update({
            status: "completed",
            paid_at: new Date().toISOString(),
          })
          .eq("id", payment.id)
          .eq("stripe_mode", stripeMode);

        if (payment.statement_id) {
          await supabaseAdmin
            .from("statements")
            .update({ status: "paid" })
            .eq("id", payment.statement_id);
        }

        const unit = payment.units as any;
        const statement = payment.statements as any;
        if (unit) {
          await sendNotificationEmail(
            supabaseUrl,
            supabaseAnonKey,
            "payment_success",
            unit.tenant_id,
            unit.properties?.landlord_id,
            {
              amount: payment.amount,
              unit_number: unit.unit_number,
              property_name: unit.properties?.name,
              period_month: statement?.period_month,
            }
          );
        }
      } else {
        logStep("Payment already marked as completed (idempotent)", {
          paymentId: payment.id,
        });
      }
    } else {
      logStep("Payment not found for payment intent", {
        paymentIntentId,
        stripe_mode: stripeMode,
        error: paymentError?.message,
      });
    }
  }
}
