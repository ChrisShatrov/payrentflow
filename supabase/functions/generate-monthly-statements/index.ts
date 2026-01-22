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
    today.setHours(0, 0, 0, 0); // Normalize to start of day for comparison
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0')
    const currentYear = today.getFullYear()
    const periodMonth = `${currentMonth}/${currentYear}`

    console.log(`Processing statements for period: ${periodMonth}`);

    // Helper function to calculate pro-rated rent
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
        // Check move-in date logic
        if (unit.move_in_date) {
          const moveInDate = new Date(unit.move_in_date);
          moveInDate.setHours(0, 0, 0, 0);
          
          // Check if move-in date is in the future
          if (moveInDate > today) {
            console.log(`Skipping statement generation for unit ${unit.id} - move-in date ${unit.move_in_date} is in the future`);
            continue;
          }
          
          // Check if statement period is before move-in month
          const statementMonthStart = new Date(currentYear, today.getMonth(), 1);
          statementMonthStart.setHours(0, 0, 0, 0);
          
          if (moveInDate > statementMonthStart) {
            console.log(`Skipping statement generation for unit ${unit.id} - move-in date ${unit.move_in_date} is after statement period ${periodMonth}`);
            continue;
          }
        }

        // Skip current month if first_month_paid is true (tenant not responsible for current month)
        if (unit.first_month_paid) {
          console.log(`Skipping statement generation for unit ${unit.id} - first month already paid`);
          continue;
        }

        // Check if statement already exists
        const { data: existing } = await supabaseClient
          .from('statements')
          .select('id')
          .eq('unit_id', unit.id)
          .eq('period_month', periodMonth)
          .single()

        if (existing) {
          // Update existing statement
          const moveInDateObj = unit.move_in_date ? new Date(unit.move_in_date) : null;
          const baseRent = calculateProratedRent(moveInDateObj, periodMonth, Number(unit.monthly_rent));
          let lateFee = 0

          const dueDate = new Date(currentYear, today.getMonth(), unit.due_day)

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
                const dailyLateFee = Number(unit.daily_late_fee || 0)
                if (dailyLateFee > 0) {
                  const daysForDailyFee = Math.max(0, daysLate - 30)
                  const dailyFee = daysForDailyFee * dailyLateFee
                  lateFee += dailyFee
                  console.log(`Applied daily late fee for unit ${unit.id} (split payment): ${daysForDailyFee} days × $${dailyLateFee} = $${dailyFee} (starting from day 31)`);
                }
                console.log(`Applied late fee for unit ${unit.id} (split payment, ${daysLate} days late): $${lateFee}`);
              } else {
                // No late fees if <= 30 days and split payment is allowed
                console.log(`No late fees for unit ${unit.id} (split payment allowed, ${daysLate} days late, <= 30 days)`);
              }
            } else {
              // Standard logic: charge fees immediately
              // One-time late fee
              if (unit.late_fee_type === 'flat') {
                lateFee = Number(unit.late_fee_amount)
              } else if (unit.late_fee_type === 'percent') {
                lateFee = (baseRent * Number(unit.late_fee_amount)) / 100
              }
              
              // Add daily late fee (only applies starting from day 2)
              const dailyLateFee = Number(unit.daily_late_fee || 0)
              if (dailyLateFee > 0) {
                // Daily fee only applies for days after the first day (so daysLate - 1)
                const daysForDailyFee = Math.max(0, daysLate - 1)
                const dailyFee = daysForDailyFee * dailyLateFee
                lateFee += dailyFee
                console.log(`Applied daily late fee for unit ${unit.id}: ${daysForDailyFee} days × $${dailyLateFee} = $${dailyFee} (starting from day 2)`);
              }
            }
          }

          // Note: Split payment fee and processing fees are NOT included
          // They are calculated dynamically at payment time
          const totalDue = baseRent + lateFee

          await supabaseClient
            .from('statements')
            .update({
              base_rent: baseRent,
              late_fee: lateFee,
              total_due: totalDue,
              status: today > dueDate ? 'overdue' : 'unpaid'
            })
            .eq('id', existing.id)

          console.log(`Updated statement for unit ${unit.id}`);
          results.push({ unit_id: unit.id, action: 'updated' })
        } else {
          // Create new statement
          const moveInDateObj = unit.move_in_date ? new Date(unit.move_in_date) : null;
          const baseRent = calculateProratedRent(moveInDateObj, periodMonth, Number(unit.monthly_rent));
          
          // Log if pro-rated
          if (moveInDateObj && baseRent !== Number(unit.monthly_rent)) {
            console.log(`Pro-rated rent calculated for unit ${unit.id}: $${baseRent} (from monthly rent $${unit.monthly_rent} for move-in date ${unit.move_in_date})`);
          }
          
          let lateFee = 0

          const dueDate = new Date(currentYear, today.getMonth(), unit.due_day)

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
                const dailyLateFee = Number(unit.daily_late_fee || 0)
                if (dailyLateFee > 0) {
                  const daysForDailyFee = Math.max(0, daysLate - 30)
                  const dailyFee = daysForDailyFee * dailyLateFee
                  lateFee += dailyFee
                  console.log(`Applied daily late fee for unit ${unit.id} (split payment): ${daysForDailyFee} days × $${dailyLateFee} = $${dailyFee} (starting from day 31)`);
                }
                console.log(`Applied late fee for unit ${unit.id} (split payment, ${daysLate} days late): $${lateFee}`);
              } else {
                // No late fees if <= 30 days and split payment is allowed
                console.log(`No late fees for unit ${unit.id} (split payment allowed, ${daysLate} days late, <= 30 days)`);
              }
            } else {
              // Standard logic: charge fees immediately
              // One-time late fee
              if (unit.late_fee_type === 'flat') {
                lateFee = Number(unit.late_fee_amount)
              } else if (unit.late_fee_type === 'percent') {
                lateFee = (baseRent * Number(unit.late_fee_amount)) / 100
              }
              
              // Add daily late fee (only applies starting from day 2)
              const dailyLateFee = Number(unit.daily_late_fee || 0)
              if (dailyLateFee > 0) {
                // Daily fee only applies for days after the first day (so daysLate - 1)
                const daysForDailyFee = Math.max(0, daysLate - 1)
                const dailyFee = daysForDailyFee * dailyLateFee
                lateFee += dailyFee
                console.log(`Applied daily late fee for unit ${unit.id}: ${daysForDailyFee} days × $${dailyLateFee} = $${dailyFee} (starting from day 2)`);
              }
            }
          }

          // Note: Split payment fee and processing fees are NOT included
          // They are calculated dynamically at payment time
          const totalDue = baseRent + lateFee

          // Determine initial status
          // If first_month_paid is true and this is the move-in month, mark as paid
          let initialStatus = today > dueDate ? 'overdue' : 'unpaid';
          if (unit.first_month_paid && moveInDateObj) {
            const statementMonthStart = new Date(currentYear, today.getMonth(), 1);
            const statementMonthEnd = new Date(currentYear, today.getMonth() + 1, 0);
            
            // Check if this is the move-in month
            if (moveInDateObj >= statementMonthStart && moveInDateObj <= statementMonthEnd) {
              initialStatus = 'paid';
              console.log(`Marking statement as paid for unit ${unit.id} - first month paid and this is the move-in month`);
            }
          }

          await supabaseClient
            .from('statements')
            .insert({
              unit_id: unit.id,
              period_month: periodMonth,
              base_rent: baseRent,
              additional_fees: 0,
              late_fee: lateFee,
              total_due: totalDue,
              status: initialStatus
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
