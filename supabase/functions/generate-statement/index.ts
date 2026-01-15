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
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { unit_id, period_month } = await req.json()
    
    console.log(`Generating statement for unit ${unit_id}, period ${period_month}`);

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

    // Check if this is the current month and first_month_paid is true
    const today = new Date();
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

    const baseRent = Number(unit.monthly_rent)
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
    const today = new Date()
    const [month, year] = period_month.split('/')
    const dueDate = new Date(parseInt(year), parseInt(month) - 1, unit.due_day)

    if (today > dueDate) {
      const daysLate = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
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

    const totalDue = baseRent + additionalFees + lateFee

    let statement
    const isNewStatement = !existingStatement;
    const lateFeeIncreased = lateFee > previousLateFee;

    if (existingStatement) {
      // Update existing statement
      console.log(`Updating existing statement ${existingStatement.id}`);
      const { data, error } = await supabaseClient
        .from('statements')
        .update({
          base_rent: baseRent,
          additional_fees: additionalFees,
          late_fee: lateFee,
          total_due: totalDue,
          status: today > dueDate ? 'overdue' : 'unpaid'
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
      const { data, error } = await supabaseClient
        .from('statements')
        .insert({
          unit_id,
          period_month,
          base_rent: baseRent,
          additional_fees: additionalFees,
          late_fee: lateFee,
          total_due: totalDue,
          status: today > dueDate ? 'overdue' : 'unpaid'
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

    // Send notification emails
    const property = unit.properties as any;
    
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
