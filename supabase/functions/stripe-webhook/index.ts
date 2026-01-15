import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const FAILED_ACH_FEE = 1000; // $10.00 in cents

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Helper function to send notification emails
async function sendNotificationEmail(
  supabaseUrl: string,
  supabaseAnonKey: string,
  type: string,
  tenant_id: string | null,
  landlord_id: string | null,
  data: Record<string, unknown>
) {
  try {
    logStep("Calling send-notification-email function", {
      type,
      tenant_id,
      landlord_id,
      data,
      url: `${supabaseUrl}/functions/v1/send-notification-email`,
    });
    
    const response = await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ type, tenant_id, landlord_id, data }),
    });
    
    const responseText = await response.text();
    logStep("Email function response", {
      status: response.status,
      statusText: response.statusText,
      response: responseText,
    });
    
    if (!response.ok) {
      logStep("Failed to send notification email", { 
        status: response.status,
        error: responseText,
      });
    } else {
      logStep("Notification email sent successfully", { 
        type,
        response: responseText,
      });
    }
  } catch (error) {
    logStep("Error sending notification email", { 
      error: String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  
  const supabaseAdmin = createClient(
    supabaseUrl,
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

      // Find the payment in our database with unit and property info
      const { data: payment, error: paymentError } = await supabaseAdmin
        .from("payments")
        .select(`
          *,
          statements(*),
          units!inner(
            id,
            unit_number,
            tenant_id,
            property_id,
            properties!inner(id, name, landlord_id)
          )
        `)
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
          failed_ach_fee_applied: true,
        })
        .eq("id", payment.id)
        .eq("failed_ach_fee_applied", false);

      if (updatePaymentError) {
        logStep("ERROR: Failed to update payment", { error: updatePaymentError.message });
        return new Response(JSON.stringify({ received: true, error: "update_failed" }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      }

      let newTotalDue = 0;

      // Add $10 failed ACH fee to the statement's additional_fees
      // Convert FAILED_ACH_FEE from cents to dollars (1000 cents = $10.00)
      if (payment.statement_id) {
        const currentAdditionalFees = payment.statements?.additional_fees || 0;
        const failedAchFeeDollars = FAILED_ACH_FEE / 100; // Convert cents to dollars
        const newAdditionalFees = currentAdditionalFees + failedAchFeeDollars;

        const { data: statement, error: statementFetchError } = await supabaseAdmin
          .from("statements")
          .select("*")
          .eq("id", payment.statement_id)
          .single();

        if (statementFetchError || !statement) {
          logStep("ERROR: Failed to fetch statement", { error: statementFetchError?.message });
        } else {
          newTotalDue = statement.base_rent + (statement.late_fee || 0) + newAdditionalFees;

          const { error: updateStatementError } = await supabaseAdmin
            .from("statements")
            .update({
              additional_fees: newAdditionalFees,
              total_due: newTotalDue,
              status: "unpaid",
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
      }

      // Send payment failed notification to both tenant and landlord
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

      return new Response(JSON.stringify({ received: true, action: "fee_applied" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Handle successful checkout session completion (primary event for Checkout Sessions)
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const sessionId = session.id;
      const paymentIntentId = session.payment_intent as string | null;

      logStep("Checkout session completed", { sessionId, paymentIntentId });

      // Find payment by session ID (which is what we stored)
      const { data: payment, error: paymentError } = await supabaseAdmin
        .from("payments")
        .select(`
          *,
          statements(period_month),
          units!inner(
            id,
            unit_number,
            tenant_id,
            property_id,
            properties!inner(id, name, landlord_id)
          )
        `)
        .eq("stripe_payment_id", sessionId)
        .single();

      if (payment && !paymentError) {
        logStep("Payment found for session", {
          paymentId: payment.id,
          currentStatus: payment.status,
          sessionId: sessionId,
        });
        
        // Only update if not already completed (idempotency)
        if (payment.status !== "completed") {
          const updateResult = await supabaseAdmin
            .from("payments")
            .update({
              status: "completed",
              paid_at: new Date().toISOString(),
            })
            .eq("id", payment.id)
            .select();

          if (updateResult.error) {
            logStep("ERROR: Failed to update payment status", {
              paymentId: payment.id,
              error: updateResult.error.message,
            });
          } else {
            logStep("Payment status updated to completed", {
              paymentId: payment.id,
              updatedRows: updateResult.data?.length,
            });
          }

          // Mark statement as paid
          if (payment.statement_id) {
            const statementUpdateResult = await supabaseAdmin
              .from("statements")
              .update({ status: "paid" })
              .eq("id", payment.statement_id)
              .select();

            if (statementUpdateResult.error) {
              logStep("ERROR: Failed to update statement status", {
                statementId: payment.statement_id,
                error: statementUpdateResult.error.message,
              });
            } else {
              logStep("Statement status updated to paid", {
                statementId: payment.statement_id,
                updatedRows: statementUpdateResult.data?.length,
              });
            }
          }

          // Send payment success notification to both tenant and landlord
          const unit = payment.units as any;
          const statement = payment.statements as any;
          if (unit) {
            logStep("Preparing to send payment success emails", {
              tenant_id: unit.tenant_id,
              landlord_id: unit.properties?.landlord_id,
              property_name: unit.properties?.name,
              unit_number: unit.unit_number,
              amount: payment.amount,
              period_month: statement?.period_month,
            });
            
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
          } else {
            logStep("WARNING: Unit data not found, cannot send payment emails", { paymentId: payment.id });
          }
        } else {
          logStep("Payment already marked as completed (idempotent)", { paymentId: payment.id });
        }
      } else {
        logStep("Payment not found for session", { sessionId, error: paymentError?.message });
      }
    }

    // Handle successful payment intent (fallback for direct payment intents)
    if (event.type === "payment_intent.succeeded" || event.type === "charge.succeeded") {
      const paymentIntent = event.type === "payment_intent.succeeded"
        ? (event.data.object as Stripe.PaymentIntent)
        : null;
      const charge = event.type === "charge.succeeded"
        ? (event.data.object as Stripe.Charge)
        : null;

      const paymentIntentId = paymentIntent?.id || charge?.payment_intent;

      if (paymentIntentId) {
        logStep("Payment intent succeeded", { paymentIntentId });

        // Try to find payment by payment intent ID first
        let { data: payment, error: paymentError } = await supabaseAdmin
          .from("payments")
          .select(`
            *,
            statements(period_month),
            units!inner(
              id,
              unit_number,
              tenant_id,
              property_id,
              properties!inner(id, name, landlord_id)
            )
          `)
          .eq("stripe_payment_id", paymentIntentId)
          .single();

        // If not found by payment intent ID, try to find by session ID
        // For Checkout Sessions, we store the session.id as stripe_payment_id
        if (paymentError && paymentIntent) {
          logStep("Payment not found by payment intent ID, trying to find by session", {
            paymentIntentId,
          });
          
          // Retrieve the payment intent to get session ID
          try {
            const fullPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
              expand: ['latest_charge.payment_method'],
            });
            
            // Get session ID from payment intent - it might be in metadata or we need to find it
            // For Checkout Sessions, the session ID is usually in the payment intent's metadata
            // or we can search for the checkout session that created this payment intent
            const sessionId = fullPaymentIntent.metadata?.session_id;
            
            // If not in metadata, try to find the checkout session that created this payment intent
            let sessionIdToSearch = sessionId;
            if (!sessionIdToSearch) {
              // List checkout sessions and find one with this payment intent
              const sessions = await stripe.checkout.sessions.list({
                payment_intent: paymentIntentId,
                limit: 1,
              });
              if (sessions.data.length > 0) {
                sessionIdToSearch = sessions.data[0].id;
                logStep("Found session ID from checkout sessions list", { sessionId: sessionIdToSearch });
              }
            }
          
            if (sessionIdToSearch) {
              logStep("Looking up payment by session ID", { sessionId: sessionIdToSearch });
              const result = await supabaseAdmin
                .from("payments")
                .select(`
                  *,
                  statements(period_month),
                  units!inner(
                    id,
                    unit_number,
                    tenant_id,
                    property_id,
                    properties!inner(id, name, landlord_id)
                  )
                `)
                .eq("stripe_payment_id", sessionIdToSearch)
                .single();
              payment = result.data;
              paymentError = result.error;
              
              if (payment) {
                logStep("Payment found by session ID", { paymentId: payment.id });
              } else {
                logStep("Payment not found by session ID either", { 
                  sessionId: sessionIdToSearch,
                  error: paymentError?.message,
                });
              }
            } else {
              logStep("Could not determine session ID from payment intent", {
                paymentIntentId,
                hasMetadata: !!fullPaymentIntent.metadata,
              });
            }
          } catch (stripeError) {
            logStep("Error retrieving payment intent from Stripe", {
              error: String(stripeError),
            });
          }
        }

        if (payment && !paymentError) {
          logStep("Payment found for payment intent", {
            paymentId: payment.id,
            currentStatus: payment.status,
            paymentIntentId: paymentIntentId,
          });
          
          // Only update if not already completed (idempotency)
          if (payment.status !== "completed") {
            const updateResult = await supabaseAdmin
              .from("payments")
              .update({
                status: "completed",
                paid_at: new Date().toISOString(),
              })
              .eq("id", payment.id)
              .select();

            if (updateResult.error) {
              logStep("ERROR: Failed to update payment status from payment_intent", {
                paymentId: payment.id,
                error: updateResult.error.message,
              });
            } else {
              logStep("Payment status updated to completed (from payment_intent)", {
                paymentId: payment.id,
                updatedRows: updateResult.data?.length,
              });
            }

            // Mark statement as paid
            if (payment.statement_id) {
              const statementUpdateResult = await supabaseAdmin
                .from("statements")
                .update({ status: "paid" })
                .eq("id", payment.statement_id)
                .select();

              if (statementUpdateResult.error) {
                logStep("ERROR: Failed to update statement status from payment_intent", {
                  statementId: payment.statement_id,
                  error: statementUpdateResult.error.message,
                });
              } else {
                logStep("Statement status updated to paid (from payment_intent)", {
                  statementId: payment.statement_id,
                  updatedRows: statementUpdateResult.data?.length,
                });
              }
            }

            // Send payment success notification to both tenant and landlord
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
            logStep("Payment already marked as completed (idempotent)", { paymentId: payment.id });
          }
        } else {
          logStep("Payment not found for payment intent", { paymentIntentId, error: paymentError?.message });
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
