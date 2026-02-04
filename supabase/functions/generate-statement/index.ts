import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    const response = await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ type, tenant_id, landlord_id, data }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.log("Failed to send notification email:", error);
    } else {
      console.log("Notification email sent successfully:", type);
    }
  } catch (error) {
    console.log("Error sending notification email:", error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const { unit_id, period_month, skip_email_notification } = await req.json()
    
    console.log(`Generating statement for unit ${unit_id}, period ${period_month}, skip_email: ${skip_email_notification}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get unit details with property info
    const { data: unit, error: unitError } = await supabaseClient
      .from('units')
      .select(`
        *,
        properties!inner(id, name, landlord_id)
      `)
      .eq('id', unit_id)
      .single()

    if (unitError || !unit) {
      console.error("Unit not found:", unitError);
      return new Response(
        JSON.stringify({ error: 'Unit not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check move-in date logic
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day for comparison
    
    if (unit.move_in_date) {
      const moveInDate = new Date(unit.move_in_date);
      moveInDate.setHours(0, 0, 0, 0);
      
      // Check if move-in date is in the future
      if (moveInDate > today) {
        console.log(`Skipping statement generation for unit ${unit_id} - move-in date ${unit.move_in_date} is in the future`);
        return new Response(
          JSON.stringify({ 
            error: 'Cannot generate statement before move-in date',
            skipped: true,
            move_in_date: unit.move_in_date
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Check if statement period is before move-in month
      // Only skip if move-in date is in a LATER month than the statement period
      const [statementMonth, statementYear] = period_month.split('/').map(Number);
      const statementMonthStart = new Date(statementYear, statementMonth - 1, 1);
      statementMonthStart.setHours(0, 0, 0, 0);
      const statementMonthEnd = new Date(statementYear, statementMonth, 0, 23, 59, 59, 999);
      
      // Skip only if move-in date is AFTER the end of the statement month
      // If move-in is within the statement month, we should generate the statement
      if (moveInDate > statementMonthEnd) {
        console.log(`Skipping statement generation for unit ${unit_id} - move-in date ${unit.move_in_date} is after statement period ${period_month}`);
        return new Response(
          JSON.stringify({ 
            error: 'Cannot generate statement for period before move-in date',
            skipped: true,
            move_in_date: unit.move_in_date,
            period_month
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if this is the current month and first_month_paid is true
    const [month, year] = period_month.split('/');
    const isCurrentMonth = parseInt(month) === today.getMonth() + 1 && parseInt(year) === today.getFullYear();
    
    if (isCurrentMonth && unit.first_month_paid) {
      console.log(`Skipping statement generation for unit ${unit_id} - first month already paid for current month ${period_month}`);
      return new Response(
        JSON.stringify({ 
          error: 'Cannot generate statement for current month when first month is already paid',
          skipped: true 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate pro-rated rent if move-in date is in the statement month
    const calculateProratedRent = (moveInDate: Date | null, periodMonth: string, monthlyRent: number): number => {
      if (!moveInDate) return monthlyRent;
      
      const [statementMonth, statementYear] = periodMonth.split('/').map(Number);
      const statementMonthStart = new Date(statementYear, statementMonth - 1, 1);
      const statementMonthEnd = new Date(statementYear, statementMonth, 0); // Last day of month
      
      // Check if move-in is in this statement month
      if (moveInDate < statementMonthStart || moveInDate > statementMonthEnd) {
        return monthlyRent; // Not the move-in month, use full rent
      }
      
      // Calculate days in month and days from move-in to end of month
      const daysInMonth = statementMonthEnd.getDate();
      const moveInDay = moveInDate.getDate();
      const daysRemaining = daysInMonth - moveInDay + 1; // +1 to include move-in day
      
      if (daysRemaining === daysInMonth) {
        return monthlyRent; // Moved in on 1st, full month
      }
      
      const proratedAmount = (monthlyRent / daysInMonth) * daysRemaining;
      return Math.round(proratedAmount * 100) / 100;
    };

    const moveInDateObj = unit.move_in_date ? new Date(unit.move_in_date) : null;
    // Calculate addon total
    const unitAddons = (unit.addons as Array<{name: string, price: number}> | null) || [];
    const addonTotal = Array.isArray(unitAddons) 
      ? unitAddons.reduce((sum, addon) => sum + Number(addon.price || 0), 0)
      : 0;
    
    if (addonTotal > 0) {
      console.log(`Unit ${unit_id} - Addons total: $${addonTotal} (${unitAddons.length} addon(s))`);
    }

    // Calculate base rent (prorated rent + addons)
    const baseRent = calculateProratedRent(moveInDateObj, period_month, Number(unit.monthly_rent)) + addonTotal
    
    // Log if pro-rated
    if (moveInDateObj && baseRent !== Number(unit.monthly_rent)) {
      console.log(`Pro-rated rent calculated for unit ${unit_id}: $${baseRent} (from monthly rent $${unit.monthly_rent} for move-in date ${unit.move_in_date})`);
    }
    let additionalFees = 0
    let lateFee = 0
    let previousLateFee = 0

    // Check for existing statement to track late fee changes
    const { data: existingStatement } = await supabaseClient
      .from('statements')
      .select('*')
      .eq('unit_id', unit_id)
      .eq('period_month', period_month)
      .single()

    if (existingStatement) {
      previousLateFee = existingStatement.late_fee || 0;
      additionalFees = existingStatement.additional_fees || 0;
    }

    // Calculate late fee if overdue
    // IMPORTANT: Late fees apply 24 hours after move-in date (move-in date + 1 day)
    // Reuse 'today' and [month, year] declared earlier
    
    // Check if this is the move-in month
    const isMoveInMonth = moveInDateObj && 
      parseInt(year) === moveInDateObj.getFullYear() &&
      parseInt(month) === moveInDateObj.getMonth() + 1;
    
    // For move-in month, use move-in date + 1 day as due date (24 hours after move-in)
    // Otherwise use standard due day
    let dueDate: Date;
    if (isMoveInMonth && moveInDateObj) {
      // Rent is due 24 hours after move-in date
      const moveInDueDate = new Date(moveInDateObj);
      moveInDueDate.setDate(moveInDueDate.getDate() + 1); // Add 1 day (24 hours)
      moveInDueDate.setHours(0, 0, 0, 0); // Normalize to start of day
      dueDate = moveInDueDate;
    } else {
      // Standard due date - normalize to start of day for accurate comparison
      dueDate = new Date(parseInt(year), parseInt(month) - 1, unit.due_day)
      dueDate.setHours(0, 0, 0, 0); // Normalize to start of day
    }

    // Add defensive logging to debug late fee calculation
    console.log(`Late fee calculation check:`, {
      today: today.toISOString(),
      dueDate: dueDate.toISOString(),
      isMoveInMonth,
      moveInDate: moveInDateObj?.toISOString(),
      period_month,
      willCalculateLateFee: today > dueDate,
      daysDifference: Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    });

    // Calculate late fees if overdue (applies to both move-in month and standard months)
    // CRITICAL: Only calculate if today is AFTER the due date (not equal to)
    // Validation: Never calculate late fees when today <= dueDate
    if (today <= dueDate) {
      console.log(`No late fees - payment is not yet due. Today: ${today.toISOString()}, Due date: ${dueDate.toISOString()}`);
      lateFee = 0;
    } else {
      const daysLate = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      console.log(`Calculating late fees - ${daysLate} days late. Due date: ${dueDate.toISOString()}, Today: ${today.toISOString()}`);
      const allowSplitPayment = Boolean(unit.allow_split_payment)

      if (allowSplitPayment) {
        // Split payment logic: No fees if <= 30 days, fees if > 30 days
        if (daysLate > 30) {
          // One-time late fee (flat or percent) - only if > 30 days
          if (unit.late_fee_type === 'flat') {
            lateFee = Number(unit.late_fee_amount)
          } else if (unit.late_fee_type === 'percent') {
            lateFee = (baseRent * Number(unit.late_fee_amount)) / 100
          }
          
          // Daily late fee - only applies starting from day 31 (so daysLate - 30)
          const daysForDailyFee = Math.max(0, daysLate - 30)
          const dailyFee = daysForDailyFee * Number(unit.daily_late_fee || 0)
          lateFee += dailyFee
          
          console.log(`Applied late fee (split payment): ${lateFee} (one-time + ${daysForDailyFee} days of daily fee × $${unit.daily_late_fee}, starting from day 31)`);
        } else {
          // No late fees if <= 30 days and split payment is allowed
          console.log(`No late fees (split payment allowed, ${daysLate} days late, <= 30 days)`);
        }
      } else {
        // Standard logic: charge fees immediately
        // One-time late fee
        if (unit.late_fee_type === 'flat') {
          lateFee = Number(unit.late_fee_amount)
        } else if (unit.late_fee_type === 'percent') {
          lateFee = (baseRent * Number(unit.late_fee_amount)) / 100
        }
        
        // Daily late fee (only applies starting from day 2)
        // Daily fee only applies for days after the first day (so daysLate - 1)
        const daysForDailyFee = Math.max(0, daysLate - 1)
        const dailyFee = daysForDailyFee * Number(unit.daily_late_fee || 0)
        lateFee += dailyFee
        
        console.log(`Applied late fee: ${lateFee} (one-time + ${daysForDailyFee} days of daily fee × $${unit.daily_late_fee})`);
      }
    }
    
    // Final validation: Ensure late fee is 0 if today <= dueDate
    if (today <= dueDate && lateFee > 0) {
      console.warn(`WARNING: Late fee calculated as ${lateFee} but today (${today.toISOString()}) is not past due date (${dueDate.toISOString()}). Setting to 0.`);
      lateFee = 0;
    }
    
    // Extra validation: If today equals move-in date, late fee must be 0
    // This ensures late fees are never applied on the move-in date itself
    if (isMoveInMonth && moveInDateObj) {
      const moveInDateStart = new Date(moveInDateObj);
      moveInDateStart.setHours(0, 0, 0, 0);
      
      if (today.getTime() === moveInDateStart.getTime()) {
        // Today is the move-in date - no late fees should apply
        console.log(`Today is move-in date (${moveInDateObj.toISOString()}), ensuring late fee is 0`);
        lateFee = 0;
      }
    }

    // For new statements (insert path), enforce 5-day rule: do not create until 5 days before due date (move-in month is exempt)
    if (!existingStatement && !isMoveInMonth) {
      const fiveDaysBeforeDue = new Date(dueDate);
      fiveDaysBeforeDue.setDate(fiveDaysBeforeDue.getDate() - 5);
      fiveDaysBeforeDue.setHours(0, 0, 0, 0);
      if (today < fiveDaysBeforeDue) {
        console.log(`Skipping statement generation for unit ${unit_id} - period ${period_month} is not yet within 5 days of due date (${dueDate.toISOString()})`);
        return new Response(
          JSON.stringify({
            error: 'Statement is generated 5 days before due date',
            skipped: true,
            reason: 'Statement is generated 5 days before due date',
            period_month,
            due_date: dueDate.toISOString()
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Calculate past due balance (unpaid/overdue statements before this period)
    const { data: pastDueStatements } = await supabaseClient
      .from('statements')
      .select('*')
      .eq('unit_id', unit_id)
      .in('status', ['unpaid', 'overdue'])
      .lt('period_month', period_month)
      .order('period_month', { ascending: true });

    const pastDueBalance = pastDueStatements?.reduce((sum, s) => 
      sum + Number(s.total_due || 0), 0) || 0;

    if (pastDueBalance > 0) {
      console.log(`Unit ${unit_id} - Including past due balance: $${pastDueBalance} from ${pastDueStatements?.length || 0} statements`);
    }

    // Add split payment fee if enabled (charged every month when split payment is allowed)
    let splitPaymentFee = 0;
    if (unit.allow_split_payment) {
      splitPaymentFee = unit.split_payment_fee ? Number(unit.split_payment_fee) : 30.00;
      console.log(`Split payment fee added to statement: $${splitPaymentFee}`);
    }

    // Include past due balance and split payment fee in total (store in additional_fees if not already set)
    const totalAdditionalFees = additionalFees + pastDueBalance + splitPaymentFee;
    const totalDue = baseRent + totalAdditionalFees + lateFee

    let statement
    const isNewStatement = !existingStatement;
    const lateFeeIncreased = lateFee > previousLateFee;

    if (existingStatement) {
      // Update existing statement
      console.log(`Updating existing statement ${existingStatement.id}`);
      
      // Determine status based on due date (accounting for move-in month)
      let updateStatus: string;
      if (isMoveInMonth && unit.first_month_paid) {
        updateStatus = 'paid';
      } else {
        // Use the calculated dueDate (which is move-in date + 1 day for move-in month)
        updateStatus = today > dueDate ? 'overdue' : 'unpaid';
      }
      
      const { data, error } = await supabaseClient
        .from('statements')
        .update({
          base_rent: baseRent,
          additional_fees: totalAdditionalFees, // Include past due balance
          late_fee: lateFee,
          total_due: totalDue,
          status: updateStatus
        })
        .eq('id', existingStatement.id)
        .select()
        .single()

      if (error) {
        console.error("Error updating statement:", error);
        throw error;
      }
      statement = data
    } else {
      // Create new statement
      console.log("Creating new statement");
      
      // Determine initial status
      // For move-in month: rent is due 24 hours after move-in date (move-in date + 1 day)
      // If first_month_paid is true and this is the move-in month, mark as paid
      let initialStatus: string;
      if (isMoveInMonth && unit.first_month_paid) {
        // First month paid - mark as paid
        initialStatus = 'paid';
        console.log(`Marking statement as paid - first month paid and this is the move-in month`);
      } else {
        // Use the calculated dueDate (which is move-in date + 1 day for move-in month, or standard due day otherwise)
        initialStatus = today > dueDate ? 'overdue' : 'unpaid';
        if (isMoveInMonth) {
          console.log(`Move-in month statement - due date: ${dueDate.toISOString()}, status: ${initialStatus}`);
        }
      }
      
      const { data, error } = await supabaseClient
        .from('statements')
        .insert({
          unit_id,
          period_month,
          base_rent: baseRent,
          additional_fees: totalAdditionalFees, // Include past due balance
          late_fee: lateFee,
          total_due: totalDue,
          status: initialStatus
        })
        .select()
        .single()

      if (error) {
        console.error("Error creating statement:", error);
        throw error;
      }
      statement = data
    }

    console.log("Statement generated successfully:", statement.id);

    // Send notification emails (unless skip_email_notification is true)
    const property = unit.properties as any;
    
    if (!skip_email_notification) {
      if (isNewStatement) {
        // Send new statement notification
        await sendNotificationEmail(
          supabaseUrl,
          supabaseAnonKey,
          "statement_generated",
          unit.tenant_id,
          property?.landlord_id,
          {
            unit_number: unit.unit_number,
            property_name: property?.name,
            period_month,
            total_due: totalDue * 100, // Convert to cents for email template
            base_rent: baseRent * 100, // Add base rent
            late_fee: lateFee * 100, // Add late fee
            past_due_balance: pastDueBalance * 100, // Add past due balance
          }
        );
      } else if (lateFeeIncreased && lateFee > 0) {
        // Send late fee notification
        await sendNotificationEmail(
          supabaseUrl,
          supabaseAnonKey,
          "late_fee_applied",
          unit.tenant_id,
          property?.landlord_id,
          {
            unit_number: unit.unit_number,
            property_name: property?.name,
            period_month,
            late_fee: lateFee * 100, // Convert to cents
            daily_late_fee: Number(unit.daily_late_fee || 0) * 100,
            total_due: totalDue * 100,
          }
        );
      }
    } else {
      console.log("Skipping email notification (skip_email_notification=true)");
    }

    return new Response(
      JSON.stringify(statement),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error("Error in generate-statement:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
