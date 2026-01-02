import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    console.log("Starting monthly statement generation...");
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get current month in MM/YYYY format
    const today = new Date()
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0')
    const currentYear = today.getFullYear()
    const periodMonth = `${currentMonth}/${currentYear}`

    console.log(`Processing statements for period: ${periodMonth}`);

    // Get all units with tenants
    const { data: units, error: unitsError } = await supabaseClient
      .from('units')
      .select('*')
      .not('tenant_id', 'is', null)

    if (unitsError) {
      console.error("Error fetching units:", unitsError);
      throw unitsError;
    }

    console.log(`Found ${units?.length || 0} units with tenants`);

    const results = []

    for (const unit of units || []) {
      try {
        // Check if statement already exists
        const { data: existing } = await supabaseClient
          .from('statements')
          .select('id')
          .eq('unit_id', unit.id)
          .eq('period_month', periodMonth)
          .single()

        if (existing) {
          // Update existing statement
          const baseRent = Number(unit.monthly_rent)
          let lateFee = 0
          let splitFee = 0

          const dueDate = new Date(currentYear, today.getMonth(), unit.due_day)

          if (today > dueDate) {
            if (unit.late_fee_type === 'flat') {
              lateFee = Number(unit.late_fee_amount)
            } else if (unit.late_fee_type === 'percent') {
              lateFee = (baseRent * Number(unit.late_fee_amount)) / 100
            }
          }

          if (unit.allow_split_payment) {
            splitFee = 49
          }

          const totalDue = baseRent + lateFee + splitFee

          await supabaseClient
            .from('statements')
            .update({
              base_rent: baseRent,
              late_fee: lateFee,
              split_fee: splitFee,
              total_due: totalDue,
              status: today > dueDate ? 'overdue' : 'unpaid'
            })
            .eq('id', existing.id)

          console.log(`Updated statement for unit ${unit.id}`);
          results.push({ unit_id: unit.id, action: 'updated' })
        } else {
          // Create new statement
          const baseRent = Number(unit.monthly_rent)
          let lateFee = 0
          let splitFee = 0

          const dueDate = new Date(currentYear, today.getMonth(), unit.due_day)

          if (today > dueDate) {
            if (unit.late_fee_type === 'flat') {
              lateFee = Number(unit.late_fee_amount)
            } else if (unit.late_fee_type === 'percent') {
              lateFee = (baseRent * Number(unit.late_fee_amount)) / 100
            }
          }

          if (unit.allow_split_payment) {
            splitFee = 49
          }

          const totalDue = baseRent + lateFee + splitFee

          await supabaseClient
            .from('statements')
            .insert({
              unit_id: unit.id,
              period_month: periodMonth,
              base_rent: baseRent,
              additional_fees: 0,
              late_fee: lateFee,
              split_fee: splitFee,
              total_due: totalDue,
              status: today > dueDate ? 'overdue' : 'unpaid'
            })

          console.log(`Created new statement for unit ${unit.id}`);
          results.push({ unit_id: unit.id, action: 'created' })
        }
      } catch (error) {
        console.error(`Error processing unit ${unit.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ unit_id: unit.id, error: errorMessage })
      }
    }

    // Mark overdue statements
    const { data: unpaidStatements } = await supabaseClient
      .from('statements')
      .select('*, units!inner(due_day)')
      .eq('status', 'unpaid')
      .eq('period_month', periodMonth)

    for (const statement of unpaidStatements || []) {
      const unit = statement.units
      const dueDate = new Date(currentYear, today.getMonth(), unit.due_day)

      if (today > dueDate) {
        await supabaseClient
          .from('statements')
          .update({ status: 'overdue' })
          .eq('id', statement.id)
        
        console.log(`Marked statement ${statement.id} as overdue`);
      }
    }

    console.log(`Completed processing ${results.length} statements`);

    return new Response(
      JSON.stringify({ 
        success: true,
        period_month: periodMonth,
        processed: results.length,
        results
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error("Error in generate-monthly-statements:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
