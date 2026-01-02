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
    const { unit_id } = await req.json()
    
    console.log(`Calculating late fee for unit ${unit_id}`);

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

    // Get current date
    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()

    // Calculate due date for current month
    const dueDate = new Date(currentYear, currentMonth, unit.due_day)

    // Check if payment is late
    if (today <= dueDate) {
      console.log("Payment is not late");
      return new Response(
        JSON.stringify({ late_fee: 0, is_late: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate days late
    const daysLate = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

    let lateFee = 0

    if (unit.late_fee_type === 'flat') {
      lateFee = Number(unit.late_fee_amount)
    } else if (unit.late_fee_type === 'percent') {
      lateFee = (Number(unit.monthly_rent) * Number(unit.late_fee_amount)) / 100
    }

    console.log(`Payment is ${daysLate} days late, fee: ${lateFee}`);

    return new Response(
      JSON.stringify({ 
        late_fee: lateFee,
        is_late: true,
        days_late: daysLate
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error("Error in calculate-late-fee:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
