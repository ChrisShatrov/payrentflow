import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { unit_id, period_month } = await req.json()
    
    console.log(`Generating statement for unit ${unit_id}, period ${period_month}`);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get unit details
    const { data: unit, error: unitError } = await supabaseClient
      .from('units')
      .select('*')
      .eq('id', unit_id)
      .single()

    if (unitError || !unit) {
      console.error("Unit not found:", unitError);
      return new Response(
        JSON.stringify({ error: 'Unit not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const baseRent = Number(unit.monthly_rent)
    let additionalFees = 0
    let lateFee = 0
    let splitFee = 0

    // Calculate late fee if overdue
    const today = new Date()
    const [month, year] = period_month.split('/')
    const dueDate = new Date(parseInt(year), parseInt(month) - 1, unit.due_day)

    if (today > dueDate) {
      // One-time late fee
      if (unit.late_fee_type === 'flat') {
        lateFee = Number(unit.late_fee_amount)
      } else if (unit.late_fee_type === 'percent') {
        lateFee = (baseRent * Number(unit.late_fee_amount)) / 100
      }
      
      // Daily late fee
      const daysLate = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      const dailyFee = daysLate * Number(unit.daily_late_fee || 0)
      lateFee += dailyFee
      
      console.log(`Applied late fee: ${lateFee} (one-time + ${daysLate} days × $${unit.daily_late_fee})`);
    }

    // Add split fee if enabled
    if (unit.allow_split_payment) {
      splitFee = 49
      console.log("Applied split payment fee: 49");
    }

    const totalDue = baseRent + additionalFees + lateFee + splitFee

    // Check if statement already exists
    const { data: existingStatement } = await supabaseClient
      .from('statements')
      .select('*')
      .eq('unit_id', unit_id)
      .eq('period_month', period_month)
      .single()

    let statement

    if (existingStatement) {
      // Update existing statement
      console.log(`Updating existing statement ${existingStatement.id}`);
      const { data, error } = await supabaseClient
        .from('statements')
        .update({
          base_rent: baseRent,
          additional_fees: additionalFees,
          late_fee: lateFee,
          split_fee: splitFee,
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
          split_fee: splitFee,
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
