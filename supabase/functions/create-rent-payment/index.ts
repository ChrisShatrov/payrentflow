import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-RENT-PAYMENT] ${step}${detailsStr}`);
};

// Fee constants
const CARD_FEE_PERCENT = 3.75;
const ACH_FEE_FLAT = 500; // $5.00 in cents
const SERVICE_CHARGE = 2500; // $25.00 in cents
const SPLIT_PAYMENT_FEE = 3000; // $30.00 in cents

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { statement_id, payment_method } = await req.json();
    if (!statement_id || !payment_method) {
      throw new Error("statement_id and payment_method are required");
    }
    if (!["card", "ach"].includes(payment_method)) {
      throw new Error("payment_method must be 'card' or 'ach'");
    }
    logStep("Request parsed", { statement_id, payment_method });

    // Get statement with unit and property info
    const { data: statement, error: statementError } = await supabaseClient
      .from("statements")
      .select(`
        *,
        unit:units (
          id,
          tenant_id,
          allow_split_payment,
          property:properties (
            landlord_id
          )
        )
      `)
      .eq("id", statement_id)
      .single();

    if (statementError || !statement) {
      throw new Error("Statement not found");
    }
    logStep("Statement fetched", { 
      total_due: statement.total_due,
      status: statement.status 
    });

    // Verify tenant owns this statement
    if (statement.unit?.tenant_id !== user.id) {
      throw new Error("Unauthorized: You can only pay your own statements");
    }

    // Get landlord's Stripe Connect account
    const landlordId = statement.unit?.property?.landlord_id;
    if (!landlordId) {
      throw new Error("Landlord not found for this property");
    }

    const { data: landlordProfile } = await supabaseClient
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", landlordId)
      .single();

    if (!landlordProfile?.stripe_account_id) {
      throw new Error("Landlord has not set up payments yet. Please contact your landlord.");
    }
    logStep("Landlord Stripe account found", { 
      accountId: landlordProfile.stripe_account_id 
    });

    // Calculate fees dynamically
    const baseAmount = Math.round(Number(statement.total_due) * 100); // Convert to cents
    let paymentMethodFee = 0;
    let splitFee = 0;

    // Add payment method fee
    if (payment_method === "card") {
      paymentMethodFee = Math.round(baseAmount * (CARD_FEE_PERCENT / 100));
    } else {
      paymentMethodFee = ACH_FEE_FLAT;
    }

    // Add split payment fee if enabled
    if (statement.unit?.allow_split_payment) {
      splitFee = SPLIT_PAYMENT_FEE;
    }

    // Total amount includes: base rent + payment method fee + service charge + split fee (if applicable)
    const totalAmount = baseAmount + paymentMethodFee + SERVICE_CHARGE + splitFee;
    
    // Application fee (what goes to the platform) = payment method fee + service charge + split fee
    const applicationFee = paymentMethodFee + SERVICE_CHARGE + splitFee;
    
    logStep("Fees calculated", {
      baseAmount,
      paymentMethodFee,
      serviceCharge: SERVICE_CHARGE,
      splitFee,
      applicationFee,
      totalAmount
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";

    // Create checkout session with Stripe Connect
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Rent Payment - ${statement.period_month}`,
              description: `Base rent: $${(baseAmount / 100).toFixed(2)}`,
            },
            unit_amount: baseAmount,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/tenant?payment=success&statement_id=${statement_id}`,
      cancel_url: `${origin}/tenant?payment=cancelled`,
      payment_intent_data: {
        application_fee_amount: applicationFee,
        transfer_data: {
          destination: landlordProfile.stripe_account_id,
        },
        metadata: {
          statement_id,
          unit_id: statement.unit?.id,
          payment_method,
          payment_method_fee: paymentMethodFee,
          service_charge: SERVICE_CHARGE,
          split_fee: splitFee,
        },
      },
      metadata: {
        statement_id,
        payment_method,
      },
    };

    // Add payment method fee as line item
    if (paymentMethodFee > 0) {
      sessionConfig.line_items!.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: payment_method === "card" ? `Card Processing Fee (${CARD_FEE_PERCENT}%)` : "ACH Processing Fee",
          },
          unit_amount: paymentMethodFee,
        },
        quantity: 1,
      });
    }

    // Add service charge as line item
    sessionConfig.line_items!.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "Service Charge",
        },
        unit_amount: SERVICE_CHARGE,
      },
      quantity: 1,
    });

    // Add split payment fee as line item if applicable
    if (splitFee > 0) {
      sessionConfig.line_items!.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Split Payment Fee",
          },
          unit_amount: splitFee,
        },
        quantity: 1,
      });
    }

    // Configure payment methods based on selection
    if (payment_method === "ach") {
      sessionConfig.payment_method_types = ["us_bank_account"];
    } else {
      sessionConfig.payment_method_types = ["card"];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    logStep("Checkout session created", { sessionId: session.id });

    // Create pending payment record
    // Convert payment method to match database constraint (ACH/Card)
    const paymentMethodDb = payment_method === "card" ? "Card" : "ACH";
    
    const { error: paymentError } = await supabaseClient
      .from("payments")
      .insert({
        unit_id: statement.unit?.id,
        statement_id: statement_id,
        amount: totalAmount / 100,
        fee_amount: applicationFee / 100,
        payment_method: paymentMethodDb,
        status: "pending",
        stripe_payment_id: session.id,
      });

    if (paymentError) {
      logStep("Error creating payment record", { error: paymentError.message });
    }

    return new Response(JSON.stringify({
      url: session.url,
      session_id: session.id,
      breakdown: {
        base_amount: baseAmount / 100,
        payment_method_fee: paymentMethodFee / 100,
        service_charge: SERVICE_CHARGE / 100,
        split_fee: splitFee / 100,
        total: totalAmount / 100,
      }
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
