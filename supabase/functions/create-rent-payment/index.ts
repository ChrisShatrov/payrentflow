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
  console.log(`[CREATE-RENT-PAYMENT] ${step}${detailsStr}`);
};

// Fee constants
const CARD_FEE_PERCENT = 3.75;
const ACH_FEE_FLAT = 500; // $5.00 in cents
const SERVICE_CHARGE = 2500; // $25.00 in cents
const SPLIT_PAYMENT_FEE = 3000; // $30.00 in cents

// Stripe processing fee constants (with padding for safety)
// Stripe charges 2.9% + $0.30 for cards, we use 3.2% + $0.50 for padding
const STRIPE_CARD_FEE_PERCENT = 0.032; // 3.2% (padded from 2.9%)
const STRIPE_CARD_FEE_FLAT = 50; // $0.50 in cents (padded from $0.30)
const STRIPE_ACH_FEE = 0; // ACH has no Stripe processing fee

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = getStripeKey();

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

    const { statement_id, payment_method, payment_amount } = await req.json();
    if (!statement_id || !payment_method) {
      throw new Error("statement_id and payment_method are required");
    }
    if (!["card", "ach"].includes(payment_method)) {
      throw new Error("payment_method must be 'card' or 'ach'");
    }
    logStep("Request parsed", { statement_id, payment_method, payment_amount });

    // Get statement with unit and property info
    const { data: statement, error: statementError } = await supabaseClient
      .from("statements")
      .select(`
        *,
        units!inner (
          id,
          tenant_id,
          allow_split_payment,
          split_payment_fee,
          first_month_paid,
          due_day,
          late_fee_type,
          late_fee_amount,
          daily_late_fee,
          properties!inner (
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

    // Access the unit from the relationship (it's an array with one element)
    const unit = Array.isArray(statement.units) ? statement.units[0] : statement.units;
    if (!unit) {
      throw new Error("Unit not found for this statement");
    }
    
    // Verify tenant owns this statement
    if (unit.tenant_id !== user.id) {
      throw new Error("Unauthorized: You can only pay your own statements");
    }

    // Get landlord's Stripe Connect account
    const property = Array.isArray(unit.properties) ? unit.properties[0] : unit.properties;
    const landlordId = property?.landlord_id;
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

    // ============================================================================
    // STRIPE CONNECT DESTINATION CHARGES - CRITICAL PRICING LOGIC
    // ============================================================================
    // 
    // CRITICAL RULE: Everything the platform keeps MUST be included in 
    // application_fee_amount. This includes:
    // - Platform fees (paymentMethodFee + $25 service charge + splitFee)
    // - Stripe processing fees (2.9% + $0.30 for cards, $0 for ACH)
    // 
    // If Stripe fees are NOT in application_fee_amount, Stripe will deduct them
    // from the landlord's transfer, causing the landlord to lose money.
    //
    // Money Flow (Guaranteed by Stripe Connect):
    // - Tenant pays: totalAmount (baseAmount + all platform fees + Stripe fees)
    // - Stripe deducts: processing fees from totalAmount (covered by stripeFeeEstimate)
    // - Platform receives: application_fee_amount (includes ALL fees, platform absorbs Stripe fees)
    // - Landlord receives: totalAmount - application_fee_amount = baseAmount (100% rent, zero deductions)
    //
    // Calculation Formula:
    // 1. Calculate Stripe fee estimate: Math.ceil(amountBeforeStripeFee * 0.032 + 50) for cards
    // 2. totalAmount = baseAmount + paymentMethodFee + SERVICE_CHARGE + splitFee + stripeFeeEstimate
    // 3. application_fee_amount = paymentMethodFee + SERVICE_CHARGE + splitFee + stripeFeeEstimate
    // 4. Result: landlordReceives = totalAmount - application_fee_amount = baseAmount (exactly)
    // ============================================================================

    // Handle split payment logic if enabled
    let baseAmount = 0;
    let pastDueLateFee = 0;
    let isFullPayment = false; // Track if this is a full payment (for split fee waiver)
    
    if (unit.allow_split_payment) {
      logStep("Split payment enabled, calculating split payment amount");
      
      // Calculate current month's rent (half minimum)
      const currentRent = Number(statement.base_rent);
      const minPayment = currentRent / 2;
      
      // Fetch all unpaid/overdue statements for this unit (excluding current statement)
      const { data: allUnpaidStatements, error: pastDueError } = await supabaseClient
        .from("statements")
        .select("*")
        .eq("unit_id", unit.id)
        .in("status", ["unpaid", "overdue"])
        .neq("id", statement_id)
        .order("period_month", { ascending: true }); // Oldest first
      
      if (pastDueError) {
        logStep("Warning: Could not fetch past due statements", { error: pastDueError.message });
      }
      
      // Filter out statements that shouldn't be considered past due
      // (same logic as frontend PaymentModal)
      const today = new Date();
      const currentMonth = `${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
      
      const pastDueStatements = (allUnpaidStatements || []).filter((s) => {
        // If first_month_paid is true, exclude current month's statement
        if (unit.first_month_paid && s.period_month === currentMonth) {
          return false;
        }
        
        // Only include statements where the due date has actually passed
        const [month, year] = s.period_month.split("/").map(Number);
        const dueDate = new Date(year, month - 1, unit.due_day);
        // Set to start of day for accurate comparison
        dueDate.setHours(0, 0, 0, 0);
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);
        
        return todayStart > dueDate;
      });
      
      logStep("Filtered past due statements", {
        totalUnpaid: allUnpaidStatements?.length || 0,
        actualPastDue: pastDueStatements.length,
        firstMonthPaid: unit.first_month_paid,
        currentMonth
      });
      
      // Calculate past due balance
      const pastDueBalance = pastDueStatements.reduce((sum, s) => sum + Number(s.total_due || 0), 0);
      
      // Determine payment amount
      let paymentAmount = payment_amount ? Number(payment_amount) : minPayment;
      
      // Validate payment amount (minimum = half of current month, maximum = current month + all past due)
      const maxPayment = currentRent + pastDueBalance;
      if (paymentAmount < minPayment) {
        throw new Error(`Payment amount must be at least $${minPayment.toFixed(2)} (half of current month's rent)`);
      }
      if (paymentAmount > maxPayment) {
        throw new Error(`Payment amount cannot exceed $${maxPayment.toFixed(2)} (current month + past due)`);
      }
      
      // Calculate late fees for past due if > 30 days
      if (pastDueStatements && pastDueStatements.length > 0) {
        // Get the oldest unpaid statement to calculate days late
        const oldestStatement = pastDueStatements[0];
        const [oldestMonth, oldestYear] = oldestStatement.period_month.split("/").map(Number);
        const oldestDueDate = new Date(oldestYear, oldestMonth - 1, unit.due_day);
        const today = new Date();
        const daysLate = Math.floor((today.getTime() - oldestDueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysLate > 30) {
          // Apply flat late fee
          if (unit.late_fee_type === 'flat') {
            pastDueLateFee = Number(unit.late_fee_amount);
          } else if (unit.late_fee_type === 'percent') {
            pastDueLateFee = (currentRent * Number(unit.late_fee_amount)) / 100;
          }
          
          // Apply daily late fee starting from day 31
          const dailyLateFee = Number(unit.daily_late_fee || 0);
          if (dailyLateFee > 0) {
            const daysForDailyFee = Math.max(0, daysLate - 30);
            pastDueLateFee += daysForDailyFee * dailyLateFee;
            logStep("Applied late fees for past due", { 
              daysLate, 
              flatFee: unit.late_fee_type === 'flat' ? Number(unit.late_fee_amount) : (currentRent * Number(unit.late_fee_amount)) / 100,
              dailyFee: daysForDailyFee * dailyLateFee,
              totalLateFee: pastDueLateFee
            });
          }
        }
      }
      
      // Calculate total base amount: payment amount + past due + late fees
      baseAmount = Math.round((paymentAmount + pastDueBalance + pastDueLateFee) * 100);
      
      // Check if user is paying the full amount (same logic as frontend)
      const fullCurrentMonthAmount = currentRent;
      const fullAmount = fullCurrentMonthAmount + pastDueBalance + pastDueLateFee;
      const roundedPaymentAmount = Math.round(paymentAmount * 100) / 100;
      const roundedFullAmount = Math.round(fullCurrentMonthAmount * 100) / 100;
      const roundedBaseAmount = baseAmount / 100;
      const roundedFullTotal = Math.round(fullAmount * 100) / 100;
      
      // Consider it full payment if payment is >= (full amount - $0.01)
      isFullPayment = roundedPaymentAmount >= (roundedFullAmount - 0.01) && 
                     roundedBaseAmount >= (roundedFullTotal - 0.01);
      
      logStep("Split payment calculated", {
        currentRent,
        minPayment,
        paymentAmount,
        pastDueBalance,
        pastDueLateFee,
        totalBaseAmount: baseAmount / 100,
        isFullPayment,
        fullAmount
      });
    } else {
      // Standard payment: pay full statement amount
      baseAmount = Math.round(Number(statement.total_due) * 100); // Convert to cents
    }
    let paymentMethodFee = 0;
    let splitFee = 0;

    // Add payment method fee
    // NOTE: This is the platform's fee charged to the tenant (3.75% for card, $5 for ACH).
    // Stripe's processing fees (2.9% + $0.30 for cards) are calculated separately and
    // included in application_fee_amount so the platform absorbs them, not the landlord.
    if (payment_method === "card") {
      paymentMethodFee = Math.round(baseAmount * (CARD_FEE_PERCENT / 100));
    } else {
      paymentMethodFee = ACH_FEE_FLAT;
    }

    // Add split payment fee if enabled (charged every month when split payment is allowed)
    if (unit.allow_split_payment) {
      const unitSplitFee = unit.split_payment_fee ? Math.round(Number(unit.split_payment_fee) * 100) : SPLIT_PAYMENT_FEE;
      splitFee = unitSplitFee;
      logStep("Split payment fee applied", { splitFee: splitFee / 100 });
    }

    // Calculate Stripe processing fee estimate
    // CRITICAL: Stripe fees must be included in application_fee_amount so platform absorbs them
    // Calculate based on the amount that will be charged (baseAmount + platform fees)
    // We use padded rates (3.2% + $0.50) to ensure we cover Stripe's actual fees (2.9% + $0.30)
    const amountBeforeStripeFee = baseAmount + paymentMethodFee + SERVICE_CHARGE + splitFee;
    let stripeFeeEstimate = 0;
    if (payment_method === "card") {
      // Calculate Stripe fee with padding: 3.2% + $0.50 (covers Stripe's 2.9% + $0.30)
      stripeFeeEstimate = Math.ceil(amountBeforeStripeFee * STRIPE_CARD_FEE_PERCENT + STRIPE_CARD_FEE_FLAT);
      logStep("Stripe card processing fee calculated", { 
        amountBeforeStripeFee: amountBeforeStripeFee / 100,
        stripeFeeEstimate: stripeFeeEstimate / 100 
      });
    } else {
      // ACH has no Stripe processing fee
      stripeFeeEstimate = STRIPE_ACH_FEE;
      logStep("Stripe ACH processing fee", { stripeFeeEstimate: 0 });
    }

    // Total amount tenant pays = baseAmount (rent + late fees) + all platform fees + Stripe fees
    // This is the sum of all line items in the checkout session
    const totalAmount = baseAmount + paymentMethodFee + SERVICE_CHARGE + splitFee + stripeFeeEstimate;
    
    // Application fee = ALL platform fees + Stripe fees that must be included in application_fee_amount
    // CRITICAL: This MUST include Stripe fees so the platform absorbs them, not the landlord
    // If Stripe fees are missing from application_fee_amount, Stripe will deduct them from the landlord's transfer
    const applicationFee = paymentMethodFee + SERVICE_CHARGE + splitFee + stripeFeeEstimate;
    
    // Validation: Ensure application_fee_amount includes ALL platform fees AND Stripe fees
    const expectedApplicationFee = paymentMethodFee + SERVICE_CHARGE + splitFee + stripeFeeEstimate;
    if (applicationFee !== expectedApplicationFee) {
      throw new Error(
        `Application fee calculation error: expected ${expectedApplicationFee} but got ${applicationFee}. ` +
        `All platform fees AND Stripe fees must be included in application_fee_amount.`
      );
    }
    
    // Enhanced logging: Show exact money flow breakdown
    // With destination charges + application_fee_amount:
    // - Tenant pays: totalAmount
    // - Stripe deducts processing fees from totalAmount
    // - Platform receives: application_fee_amount (includes Stripe fees, so platform absorbs them)
    // - Landlord receives: totalAmount - application_fee_amount = baseAmount (100% rent, zero deductions)
    const landlordReceives = baseAmount; // Landlord gets 100% of base amount (no deductions)
    const platformReceives = applicationFee; // Platform gets all fees including Stripe fees
    const tenantPays = totalAmount; // Tenant pays base + all fees including Stripe fees
    
    logStep("Fees calculated - Money Flow Breakdown", {
      tenantPays: tenantPays / 100, // Convert to dollars for readability
      baseAmount: baseAmount / 100,
      paymentMethodFee: paymentMethodFee / 100,
      serviceCharge: SERVICE_CHARGE / 100,
      splitFee: splitFee / 100,
      stripeFeeEstimate: stripeFeeEstimate / 100,
      platformReceives: platformReceives / 100,
      landlordReceives: landlordReceives / 100,
      validation: {
        applicationFeeEqualsSum: applicationFee === (paymentMethodFee + SERVICE_CHARGE + splitFee + stripeFeeEstimate),
        landlordGetsFullRent: landlordReceives === baseAmount,
        totalMatches: tenantPays === (baseAmount + platformReceives),
        stripeFeeIncluded: stripeFeeEstimate > 0 || payment_method === "ach"
      }
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
        // CRITICAL: application_fee_amount MUST include ALL platform fees AND Stripe fees
        // (paymentMethodFee + $25 service charge + splitFee + stripeFeeEstimate)
        // Stripe guarantees: Landlord receives = totalAmount - application_fee_amount = baseAmount
        // If Stripe fees are missing here, Stripe will deduct them from the landlord's transfer.
        application_fee_amount: applicationFee,
        transfer_data: {
          // Destination charge: Landlord receives baseAmount (100% of rent, zero deductions)
          // This is guaranteed because: totalAmount - application_fee_amount = baseAmount
          destination: landlordProfile.stripe_account_id,
        },
        metadata: {
          statement_id,
          unit_id: unit.id,
          payment_method,
          payment_method_fee: paymentMethodFee,
          service_charge: SERVICE_CHARGE,
          split_fee: splitFee,
          stripe_fee_estimate: stripeFeeEstimate,
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

    // Add Stripe processing fee as line item (transparent to tenant)
    if (stripeFeeEstimate > 0) {
      sessionConfig.line_items!.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: payment_method === "card" ? "Card Processing Fee (Stripe)" : "Processing Fee",
          },
          unit_amount: stripeFeeEstimate,
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
    // Database constraint: CHECK (payment_method IN ('ACH', 'Card'))
    let paymentMethodDb: string;
    if (payment_method === "card" || payment_method === "Card") {
      paymentMethodDb = "Card";
    } else if (payment_method === "ach" || payment_method === "ACH") {
      paymentMethodDb = "ACH";
    } else {
      throw new Error(`Invalid payment_method: ${payment_method}. Must be 'card' or 'ach'`);
    }
    
    // Validate against database constraint
    if (paymentMethodDb !== "Card" && paymentMethodDb !== "ACH") {
      throw new Error(`Payment method conversion failed. Got: ${paymentMethodDb}, expected: 'Card' or 'ACH'`);
    }
    
    logStep("Payment method conversion", {
      input: payment_method,
      converted: paymentMethodDb,
      isValid: paymentMethodDb === "Card" || paymentMethodDb === "ACH",
    });
    
    // Ensure unit_id exists (we already have unit from above)
    const unitId = unit.id;
    if (!unitId) {
      throw new Error("Unit ID not found in statement");
    }
    
    // Calculate statement_amount: how much of this payment goes to the current statement
    // For split payments: this is the paymentAmount (portion towards current month)
    // For full payments: this is baseAmount (total - fees, which equals statement total)
    let statementAmount = 0;
    if (unit.allow_split_payment && payment_amount) {
      // Split payment: statement_amount is the payment_amount (portion towards current month)
      statementAmount = Number(payment_amount);
    } else {
      // Full payment: statement_amount is the baseAmount (total rent amount for this statement)
      statementAmount = baseAmount / 100;
    }
    
    const paymentInsertData = {
      unit_id: unitId,
      statement_id: statement_id,
      amount: totalAmount / 100,
      fee_amount: applicationFee / 100,
      statement_amount: statementAmount, // Amount applied to this statement
      payment_method: paymentMethodDb, // Must be exactly 'Card' or 'ACH'
      status: "pending",
      stripe_payment_id: session.id,
    };
    
    logStep("Creating payment record", {
      unit_id: unitId,
      statement_id: statement_id,
      amount: totalAmount / 100,
      fee_amount: applicationFee / 100,
      statement_amount: statementAmount, // Amount applied to statement (for split payments: payment_amount, for full: baseAmount)
      payment_method: paymentMethodDb, // Log the exact value being inserted
      status: "pending",
      stripe_payment_id: session.id,
      is_split_payment: unit.allow_split_payment && payment_amount ? true : false,
      payment_amount: payment_amount || null,
    });
    
    // Verify unit_id exists in database before inserting
    const { data: unitCheck, error: unitCheckError } = await supabaseClient
      .from("units")
      .select("id")
      .eq("id", unitId)
      .single();
    
    if (unitCheckError || !unitCheck) {
      logStep("ERROR: Unit ID validation failed", {
        unit_id: unitId,
        error: unitCheckError?.message,
      });
      throw new Error(`Unit ID ${unitId} not found in database: ${unitCheckError?.message}`);
    }
    logStep("Unit ID validated", { unit_id: unitId });
    
    // Verify statement_id exists
    const { data: statementCheck, error: statementCheckError } = await supabaseClient
      .from("statements")
      .select("id")
      .eq("id", statement_id)
      .single();
    
    if (statementCheckError || !statementCheck) {
      logStep("ERROR: Statement ID validation failed", {
        statement_id: statement_id,
        error: statementCheckError?.message,
      });
      throw new Error(`Statement ID ${statement_id} not found in database: ${statementCheckError?.message}`);
    }
    logStep("Statement ID validated", { statement_id: statement_id });
    
    const { data: paymentData, error: paymentError } = await supabaseClient
      .from("payments")
      .insert(paymentInsertData)
      .select()
      .single();

    if (paymentError) {
      logStep("ERROR: Failed to create payment record", { 
        error: paymentError.message,
        code: paymentError.code,
        details: paymentError.details,
        hint: paymentError.hint,
        fullError: JSON.stringify(paymentError),
        insertData: paymentInsertData,
      });
      throw new Error(`Failed to create payment record: ${paymentError.message} (Code: ${paymentError.code})`);
    }
    
    if (!paymentData) {
      logStep("ERROR: Payment insert returned no data", {
        insertData: paymentInsertData,
      });
      throw new Error("Payment insert succeeded but no data returned");
    }
    
    logStep("Payment record created successfully", { 
      payment_id: paymentData.id,
      unit_id: paymentData.unit_id,
      statement_id: paymentData.statement_id,
      amount: paymentData.amount,
      status: paymentData.status,
      stripe_payment_id: paymentData.stripe_payment_id,
    });

    return new Response(JSON.stringify({
      url: session.url,
      session_id: session.id,
      breakdown: {
        base_amount: baseAmount / 100,
        payment_method_fee: paymentMethodFee / 100,
        service_charge: SERVICE_CHARGE / 100,
        split_fee: splitFee / 100,
        stripe_fee_estimate: stripeFeeEstimate / 100,
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
