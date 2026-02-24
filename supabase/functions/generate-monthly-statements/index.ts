import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    console.log("Starting monthly statement generation...");
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get current date
    const today = new Date()
    today.setHours(0, 0, 0, 0); // Normalize to start of day for comparison
    const currentMonth = today.getMonth() + 1
    const currentYear = today.getFullYear()

    console.log(`Processing statements - checking which statements need to be generated 5 days before due date`);

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

    const results: Array<{ unit_id: string; action?: string; period_month?: string; error?: string }> = []

    for (const unit of units || []) {
      try {
        // Calculate target month: 5 days before due date
        // For each month, check if we're 5 days before its due date
        // Check current month and next month
        for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
          const targetMonth = currentMonth + monthOffset;
          const targetYear = monthOffset === 0 && targetMonth > 12 ? currentYear + 1 : 
                           monthOffset === 1 && targetMonth > 12 ? currentYear + 1 :
                           currentYear;
          const actualMonth = targetMonth > 12 ? targetMonth - 12 : targetMonth;
          
          // Calculate due date for this month
          const dueDate = new Date(targetYear, actualMonth - 1, unit.due_day);
          dueDate.setHours(0, 0, 0, 0);
          
          // Calculate target date (5 days before due date)
          const targetDate = new Date(dueDate);
          targetDate.setDate(targetDate.getDate() - 5);
          
          // Only generate if today >= targetDate (we're at or past 5 days before due date)
          if (today < targetDate) {
            console.log(`Skipping unit ${unit.id} - not yet 5 days before due date for ${actualMonth}/${targetYear}`);
            continue;
          }
          
          const periodMonth = `${String(actualMonth).padStart(2, '0')}/${targetYear}`;
          
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
            const statementMonthStart = new Date(targetYear, actualMonth - 1, 1);
            statementMonthStart.setHours(0, 0, 0, 0);
            const statementMonthEnd = new Date(targetYear, actualMonth, 0, 23, 59, 59, 999);
            
            // Skip only if move-in date is AFTER the end of the statement month
            if (moveInDate > statementMonthEnd) {
              console.log(`Skipping statement generation for unit ${unit.id} - move-in date ${unit.move_in_date} is after statement period ${periodMonth}`);
              continue;
            }
          }

          // Skip if first_month_paid is true and this is the move-in month
          if (unit.first_month_paid && unit.move_in_date) {
            const moveInDate = new Date(unit.move_in_date);
            const statementMonthStart = new Date(targetYear, actualMonth - 1, 1);
            const statementMonthEnd = new Date(targetYear, actualMonth, 0, 23, 59, 59, 999);
            
            if (moveInDate >= statementMonthStart && moveInDate <= statementMonthEnd) {
              console.log(`Skipping statement generation for unit ${unit.id} - first month already paid for ${periodMonth}`);
              continue;
            }
          }

          // Check if statement already exists
          const { data: existing } = await supabaseClient
            .from('statements')
            .select('id')
            .eq('unit_id', unit.id)
            .eq('period_month', periodMonth)
            .maybeSingle()

          // Get past due statements (unpaid/overdue statements before this period)
          const { data: pastDueStatements } = await supabaseClient
            .from('statements')
            .select('*')
            .eq('unit_id', unit.id)
            .in('status', ['unpaid', 'overdue'])
            .lt('period_month', periodMonth)
            .order('period_month', { ascending: true });

          // Calculate past due balance
          const pastDueBalance = pastDueStatements?.reduce((sum, s) => 
            sum + Number(s.total_due || 0), 0) || 0;

          console.log(`Unit ${unit.id} - Past due balance: $${pastDueBalance} from ${pastDueStatements?.length || 0} statements`);

        if (existing) {
          // Update existing statement
          const moveInDateObj = unit.move_in_date ? new Date(unit.move_in_date) : null;
          const baseRent = calculateProratedRent(moveInDateObj, periodMonth, Number(unit.monthly_rent));
          let lateFee = 0

          const isMoveInMonth = moveInDateObj &&
            moveInDateObj.getFullYear() === targetYear &&
            moveInDateObj.getMonth() === actualMonth - 1;

          // Use the calculated due date for the target month
          const dueDate = new Date(targetYear, actualMonth - 1, unit.due_day);
          dueDate.setHours(0, 0, 0, 0);

          if (!isMoveInMonth && today > dueDate) {
            const allowSplitPayment = Boolean(unit.allow_split_payment)
            const todayMonthNum = today.getMonth() + 1
            const todayYearNum = today.getFullYear()

            if (allowSplitPayment) {
              // Split payment: no late fee during statement month; late fee from 1st of next month
              const stillInStatementMonth = todayYearNum === targetYear && todayMonthNum === actualMonth
              if (stillInStatementMonth || todayYearNum < targetYear || (todayYearNum === targetYear && todayMonthNum < actualMonth)) {
                lateFee = 0
                console.log(`No late fees for unit ${unit.id} (split payment) - in or before statement month ${periodMonth}`);
              } else {
                const lateFeeStartDate = new Date(targetYear, actualMonth, 1)
                lateFeeStartDate.setHours(0, 0, 0, 0)
                const daysLate = Math.floor((today.getTime() - lateFeeStartDate.getTime()) / (1000 * 60 * 60 * 24))
                if (unit.late_fee_type === 'flat') {
                  lateFee = Number(unit.late_fee_amount)
                } else if (unit.late_fee_type === 'percent') {
                  lateFee = (baseRent * Number(unit.late_fee_amount)) / 100
                }
                const dailyLateFee = Number(unit.daily_late_fee || 0)
                if (dailyLateFee > 0) {
                  const daysForDailyFee = Math.max(0, daysLate - 1)
                  lateFee += daysForDailyFee * dailyLateFee
                  console.log(`Applied daily late fee for unit ${unit.id} (split payment): ${daysForDailyFee} days × $${dailyLateFee} (from ${lateFeeStartDate.toISOString()})`);
                }
                console.log(`Applied late fee for unit ${unit.id} (split payment): $${lateFee}`);
              }
            } else {
              const daysLate = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
              // Standard logic: charge fees immediately
              if (unit.late_fee_type === 'flat') {
                lateFee = Number(unit.late_fee_amount)
              } else if (unit.late_fee_type === 'percent') {
                lateFee = (baseRent * Number(unit.late_fee_amount)) / 100
              }
              const dailyLateFee = Number(unit.daily_late_fee || 0)
              if (dailyLateFee > 0) {
                const daysForDailyFee = Math.max(0, daysLate - 1)
                const dailyFee = daysForDailyFee * dailyLateFee
                lateFee += dailyFee
                console.log(`Applied daily late fee for unit ${unit.id}: ${daysForDailyFee} days × $${dailyLateFee} = $${dailyFee} (starting from day 2)`);
              }
            }
          } else if (isMoveInMonth) {
            console.log(`No late fees for unit ${unit.id} - first month (move-in month)`);
          }

          // Note: Split payment fee and processing fees are NOT included
          // They are calculated dynamically at payment time
          // Include past due balance in total
          const totalDue = baseRent + lateFee + pastDueBalance

          await supabaseClient
            .from('statements')
            .update({
              base_rent: baseRent,
              late_fee: lateFee,
              additional_fees: pastDueBalance, // Store past due in additional_fees
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

          const isMoveInMonth = moveInDateObj &&
            moveInDateObj.getFullYear() === targetYear &&
            moveInDateObj.getMonth() === actualMonth - 1;

          // Use the calculated due date for the target month
          const dueDate = new Date(targetYear, actualMonth - 1, unit.due_day);
          dueDate.setHours(0, 0, 0, 0);

          if (!isMoveInMonth && today > dueDate) {
            const allowSplitPayment = Boolean(unit.allow_split_payment)
            const todayMonthNum = today.getMonth() + 1
            const todayYearNum = today.getFullYear()

            if (allowSplitPayment) {
              // Split payment: no late fee during statement month; late fee from 1st of next month
              const stillInStatementMonth = todayYearNum === targetYear && todayMonthNum === actualMonth
              if (stillInStatementMonth || todayYearNum < targetYear || (todayYearNum === targetYear && todayMonthNum < actualMonth)) {
                lateFee = 0
                console.log(`No late fees for unit ${unit.id} (split payment) - in or before statement month ${periodMonth}`);
              } else {
                const lateFeeStartDate = new Date(targetYear, actualMonth, 1)
                lateFeeStartDate.setHours(0, 0, 0, 0)
                const daysLate = Math.floor((today.getTime() - lateFeeStartDate.getTime()) / (1000 * 60 * 60 * 24))
                if (unit.late_fee_type === 'flat') {
                  lateFee = Number(unit.late_fee_amount)
                } else if (unit.late_fee_type === 'percent') {
                  lateFee = (baseRent * Number(unit.late_fee_amount)) / 100
                }
                const dailyLateFee = Number(unit.daily_late_fee || 0)
                if (dailyLateFee > 0) {
                  const daysForDailyFee = Math.max(0, daysLate - 1)
                  lateFee += daysForDailyFee * dailyLateFee
                  console.log(`Applied daily late fee for unit ${unit.id} (split payment): ${daysForDailyFee} days × $${dailyLateFee} (from ${lateFeeStartDate.toISOString()})`);
                }
                console.log(`Applied late fee for unit ${unit.id} (split payment): $${lateFee}`);
              }
            } else {
              const daysLate = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
              // Standard logic: charge fees immediately
              if (unit.late_fee_type === 'flat') {
                lateFee = Number(unit.late_fee_amount)
              } else if (unit.late_fee_type === 'percent') {
                lateFee = (baseRent * Number(unit.late_fee_amount)) / 100
              }
              const dailyLateFee = Number(unit.daily_late_fee || 0)
              if (dailyLateFee > 0) {
                const daysForDailyFee = Math.max(0, daysLate - 1)
                const dailyFee = daysForDailyFee * dailyLateFee
                lateFee += dailyFee
                console.log(`Applied daily late fee for unit ${unit.id}: ${daysForDailyFee} days × $${dailyLateFee} = $${dailyFee} (starting from day 2)`);
              }
            }
          } else if (isMoveInMonth) {
            console.log(`No late fees for unit ${unit.id} - first month (move-in month)`);
          }

          // Note: Split payment fee and processing fees are NOT included
          // They are calculated dynamically at payment time
          // Include past due balance in total
          const totalDue = baseRent + lateFee + pastDueBalance

          // Determine initial status
          // If first_month_paid is true and this is the move-in month, mark as paid
          let initialStatus = today > dueDate ? 'overdue' : 'unpaid';
          if (unit.first_month_paid && moveInDateObj) {
            const statementMonthStart = new Date(targetYear, actualMonth - 1, 1);
            const statementMonthEnd = new Date(targetYear, actualMonth, 0, 23, 59, 59, 999);
            
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
              additional_fees: pastDueBalance, // Store past due in additional_fees
              late_fee: lateFee,
              total_due: totalDue,
              status: initialStatus
            })

          console.log(`Created new statement for unit ${unit.id} for ${periodMonth} with past due: $${pastDueBalance}`);
          results.push({ unit_id: unit.id, action: 'created', period_month: periodMonth })
        }
        } // End of monthOffset loop
      } catch (error) {
        console.error(`Error processing unit ${unit.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ unit_id: unit.id, error: errorMessage })
      }
    }

    // Mark overdue statements for all periods (not just current month)
    const { data: unpaidStatements } = await supabaseClient
      .from('statements')
      .select('*, units!inner(due_day)')
      .eq('status', 'unpaid')

    for (const statement of unpaidStatements || []) {
      const unit = statement.units
      const [month, year] = statement.period_month.split('/').map(Number);
      const dueDate = new Date(year, month - 1, unit.due_day)
      dueDate.setHours(0, 0, 0, 0);

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
