import { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { TenantLayout } from "@/components/tenant/TenantLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Home,
  FileText,
  Wrench,
  MessageSquare,
  Settings,
  HelpCircle,
  ArrowUpRight,
  Clock,
  MapPin,
  ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, differenceInDays, parseISO, startOfDay } from "date-fns";
import { PaymentModal } from "@/components/tenant/PaymentModal";
import { DocumentsModal } from "@/components/tenant/DocumentsModal";
import { MaintenanceModal } from "@/components/tenant/MaintenanceModal";
import { ContactModal } from "@/components/tenant/ContactModal";
import { TenantSettingsModal } from "@/components/tenant/TenantSettingsModal";
import { HelpModal } from "@/components/tenant/HelpModal";
import { toast } from "sonner";

interface UnitData {
  id: string;
  unit_number: string;
  monthly_rent: number;
  due_day: number;
  allow_split_payment: boolean;
  lease_pdf_url: string | null;
  daily_late_fee: number;
  late_fee_type?: string;
  late_fee_amount?: number;
  first_month_paid?: boolean;
  property: {
    name: string;
    address: string;
  } | null;
}

interface StatementData {
  id: string;
  total_due: number;
  status: string;
  period_month: string;
  base_rent: number;
  late_fee: number;
  additional_fees: number;
  split_fee: number;
}

interface PaymentData {
  id: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export default function TenantDashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [unit, setUnit] = useState<UnitData | null>(null);
  const [currentStatement, setCurrentStatement] = useState<StatementData | null>(null);
  const [recentPayments, setRecentPayments] = useState<PaymentData[]>([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [tenantProfile, setTenantProfile] = useState<{ full_name: string; email: string } | null>(null);
  const [paymentStreak, setPaymentStreak] = useState<number | null>(null);
  const [remainingBalance, setRemainingBalance] = useState<number | null>(null);

  const fetchTenantData = useCallback(async () => {
    try {
      if (!user?.id) {
        console.error("[TenantDashboard] No user ID available");
        return;
      }

      console.log("[TenantDashboard] Fetching data for user:", user.id);

      // Fetch tenant profile
      let { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, email, id")
        .eq("id", user.id)
        .single();
      
      console.log("[TenantDashboard] Profile data:", { profileData, profileError });
      
      // If no profile exists, try to create one from auth user data
      if (!profileData && user.email) {
        console.log("[TenantDashboard] No profile found, attempting to create one from auth user data");
        const { data: authUser } = await supabase.auth.getUser();
        
        if (authUser?.user) {
          // Try to insert, but handle conflict if profile already exists
          const { data: newProfile, error: createError } = await supabase
            .from("profiles")
            .upsert({
              id: user.id,
              email: user.email || authUser.user.email || "",
              full_name: authUser.user.user_metadata?.full_name || null,
              phone: authUser.user.user_metadata?.phone || null,
              role: authUser.user.user_metadata?.role || "tenant",
            }, {
              onConflict: 'id'
            })
            .select()
            .single();
          
          if (newProfile && !createError) {
            console.log("[TenantDashboard] Profile created/updated successfully:", newProfile);
            profileData = newProfile;
            setTenantProfile(newProfile);
          } else {
            console.error("[TenantDashboard] Failed to create profile:", createError);
            // Try to fetch again in case it was created by another process
            const { data: retryProfile } = await supabase
              .from("profiles")
              .select("full_name, email, id")
              .eq("id", user.id)
              .single();
            
            if (retryProfile) {
              console.log("[TenantDashboard] Profile found on retry:", retryProfile);
              profileData = retryProfile;
              setTenantProfile(retryProfile);
            } else {
              toast.error("Profile creation failed. Please contact support.");
            }
          }
        }
      } else if (profileData) {
        setTenantProfile(profileData);
      } else if (!user.email) {
        console.error("[TenantDashboard] No email available for user:", user.id);
        toast.error("User email not found. Please contact support.");
      }

      // Fetch tenant's unit with property info
      console.log("[TenantDashboard] Querying units with tenant_id:", user.id);
      const { data: unitData, error: unitError } = await supabase
        .from("units")
        .select(`
          id,
          unit_number,
          monthly_rent,
          due_day,
          allow_split_payment,
          split_payment_fee,
          lease_pdf_url,
          daily_late_fee,
          late_fee_type,
          late_fee_amount,
          first_month_paid,
          tenant_id,
          property:properties (
            name,
            address
          )
        `)
        .eq("tenant_id", user.id)
        .maybeSingle();

      console.log("[TenantDashboard] Unit query result:", { unitData, unitError });

      // If no unit found, try to find by email as fallback
      if (!unitData && profileData?.email) {
        console.log("[TenantDashboard] No unit found by tenant_id, trying email lookup:", profileData.email);
        // Try to find unit by matching tenant email in profiles
        const { data: unitsByEmail } = await supabase
          .from("units")
          .select(`
            id,
            unit_number,
            monthly_rent,
            due_day,
            allow_split_payment,
            split_payment_fee,
            lease_pdf_url,
            daily_late_fee,
            late_fee_type,
            late_fee_amount,
            first_month_paid,
            tenant_id,
            profiles:tenant_id(id, email),
            property:properties (
              name,
              address
            )
          `)
          .not("tenant_id", "is", null);

        console.log("[TenantDashboard] All units with tenants:", unitsByEmail);
        
        // Find unit where tenant email matches
        const matchingUnit = unitsByEmail?.find((u: any) => u.profiles?.email === profileData.email);
        if (matchingUnit) {
          console.log("[TenantDashboard] Found unit by email match:", matchingUnit);
          // If found by email but tenant_id doesn't match, there's a data mismatch
          if (matchingUnit.tenant_id !== user.id) {
            console.warn("[TenantDashboard] WARNING: Unit tenant_id doesn't match user ID!", {
              unitTenantId: matchingUnit.tenant_id,
              userId: user.id,
              tenantEmail: profileData.email
            });
            toast.error("Unit assignment mismatch detected. Please contact support.");
          }
        }
      }

      if (unitData) {
        console.log("[TenantDashboard] Unit found successfully:", unitData);
        setUnit(unitData as unknown as UnitData);

        // Skip current month's statement if first_month_paid is true
        const currentMonth = format(new Date(), "MM/yyyy");
        const shouldSkipCurrentMonth = unitData.first_month_paid === true;

        if (!shouldSkipCurrentMonth) {
          // First, check if current month's statement exists and is paid
          const { data: currentMonthStatement } = await supabase
            .from("statements")
            .select("*")
            .eq("unit_id", unitData.id)
            .eq("period_month", currentMonth)
            .maybeSingle();

          // If current month is paid, look for next unpaid statement
          if (currentMonthStatement && currentMonthStatement.status === "paid") {
            console.log("[TenantDashboard] Current month is paid, looking for next unpaid statement");
            
            // Find the next unpaid statement (could be next month or future)
            // Order by period_month ascending to get the earliest unpaid statement
            const { data: unpaidStatements } = await supabase
              .from("statements")
              .select("*")
              .eq("unit_id", unitData.id)
              .in("status", ["unpaid", "overdue", "partial"])
              .order("period_month", { ascending: true })
              .limit(1);
            
            if (unpaidStatements && unpaidStatements.length > 0) {
              console.log("[TenantDashboard] Found next unpaid statement:", unpaidStatements[0].period_month);
              setCurrentStatement(unpaidStatements[0]);
            } else {
              // No unpaid statements, try to generate next month's statement
              const today = new Date();
              const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
              const nextMonthStr = format(nextMonth, "MM/yyyy");
              
              console.log("[TenantDashboard] No unpaid statements found, generating next month:", nextMonthStr);
              try {
                const { data: generatedStatement } = await supabase.functions.invoke("generate-statement", {
                  body: { unit_id: unitData.id, period_month: nextMonthStr }
                });

                if (generatedStatement) {
                  const { data: newStatement } = await supabase
                    .from("statements")
                    .select("*")
                    .eq("unit_id", unitData.id)
                    .eq("period_month", nextMonthStr)
                    .maybeSingle();
                  
                  if (newStatement) {
                    console.log("[TenantDashboard] Generated and set next month statement:", nextMonthStr);
                    setCurrentStatement(newStatement);
                  } else {
                    setCurrentStatement(null);
                  }
                } else {
                  setCurrentStatement(null);
                }
              } catch (error) {
                console.error("Error generating next month statement:", error);
                setCurrentStatement(null);
              }
            }
          } else if (currentMonthStatement) {
            // Current month statement exists and is not paid
            setCurrentStatement(currentMonthStatement);
          } else {
            // If no statement for current month, try to generate one
            try {
              const { data: generatedStatement, error: generateError } = await supabase.functions.invoke("generate-statement", {
                body: { unit_id: unitData.id, period_month: currentMonth }
              });

              if (!generateError && generatedStatement) {
                // Fetch the newly created statement
                const { data: newStatement } = await supabase
                  .from("statements")
                  .select("*")
                  .eq("unit_id", unitData.id)
                  .eq("period_month", currentMonth)
                  .maybeSingle();
                
                if (newStatement) {
                  setCurrentStatement(newStatement);
                } else {
                  // If generation failed or was skipped, check for any unpaid/overdue statement
                  const { data: overdueStatement } = await supabase
                    .from("statements")
                    .select("*")
                    .eq("unit_id", unitData.id)
                    .in("status", ["unpaid", "overdue"])
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  
                  if (overdueStatement) {
                    setCurrentStatement(overdueStatement);
                  }
                }
              } else {
                // Generation failed (might be first_month_paid), check for any unpaid/overdue statement
                const { data: overdueStatement } = await supabase
                  .from("statements")
                  .select("*")
                  .eq("unit_id", unitData.id)
                  .in("status", ["unpaid", "overdue"])
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                
                if (overdueStatement) {
                  setCurrentStatement(overdueStatement);
                }
              }
            } catch (error) {
              console.error("Error generating statement:", error);
              // Fallback: check for any unpaid/overdue statement
              const { data: overdueStatement } = await supabase
                .from("statements")
                .select("*")
                .eq("unit_id", unitData.id)
                .in("status", ["unpaid", "overdue"])
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              
              if (overdueStatement) {
                setCurrentStatement(overdueStatement);
              }
            }
          }
        } else {
          // First month paid - skip current month entirely
          console.log("[TenantDashboard] First month paid, skipping current month. Looking for next month's statement.");
          
          // Calculate next month
          const today = new Date();
          const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
          const nextMonthStr = format(nextMonth, "MM/yyyy");
          
          // IMPORTANT: When first_month_paid is true, we should NOT show the current month's statement
          // even if it exists and is unpaid/overdue. The tenant is not responsible for it.
          
          // Look for next month's statement (or any future month)
          const { data: nextMonthStatement } = await supabase
            .from("statements")
            .select("*")
            .eq("unit_id", unitData.id)
            .eq("period_month", nextMonthStr)
            .maybeSingle();
          
          if (nextMonthStatement) {
            console.log("[TenantDashboard] Found next month's statement:", nextMonthStr);
            setCurrentStatement(nextMonthStatement);
          } else {
            // Try to generate next month's statement
            try {
              console.log("[TenantDashboard] Generating next month's statement:", nextMonthStr);
              const { data: generatedStatement, error: generateError } = await supabase.functions.invoke("generate-statement", {
                body: { unit_id: unitData.id, period_month: nextMonthStr }
              });

              if (!generateError && generatedStatement) {
                // Fetch the newly created statement
                const { data: newStatement } = await supabase
                  .from("statements")
                  .select("*")
                  .eq("unit_id", unitData.id)
                  .eq("period_month", nextMonthStr)
                  .maybeSingle();
                
                if (newStatement) {
                  setCurrentStatement(newStatement);
                } else {
                  console.log("[TenantDashboard] Next month statement generated but could not fetch");
                  setCurrentStatement(null);
                }
              } else {
                console.log("[TenantDashboard] Could not generate next month's statement, will show nothing");
                setCurrentStatement(null);
              }
            } catch (error) {
              console.error("Error generating next month statement:", error);
              setCurrentStatement(null);
            }
          }
          
          // Explicitly do NOT show current month's statement, even if it exists
          // The tenant is not responsible for it when first_month_paid is true
        }

        // Fetch recent payments (limit to 2-3 for dashboard)
        // Filter out old pending payments (older than 1 hour) - these are likely abandoned
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: paymentsData } = await supabase
          .from("payments")
          .select("*")
          .eq("unit_id", unitData.id)
          .order("created_at", { ascending: false })
          .limit(10); // Fetch more to filter, then limit to 3

        if (paymentsData) {
          // Filter out old pending payments
          const filteredPayments = paymentsData.filter((p) => {
            // Show all completed/failed payments
            if (p.status !== "pending") return true;
            // For pending payments, only show if created within last hour
            return new Date(p.created_at) > new Date(oneHourAgo);
          }).slice(0, 3); // Limit to 3 most recent after filtering
          
          setRecentPayments(filteredPayments);
          
          // Calculate total paid this year (base rent amount only, excluding fees and late fees)
          const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
          const { data: yearPayments } = await supabase
            .from("payments")
            .select("statement_amount, statement_id")
            .eq("unit_id", unitData.id)
            .eq("status", "completed")
            .gte("paid_at", yearStart)
            .not("statement_id", "is", null);
          
          if (yearPayments && yearPayments.length > 0) {
            // Get all unique statement IDs to fetch base_rent for each
            const statementIds = [...new Set(yearPayments.map(p => p.statement_id).filter(Boolean))];
            
            // Fetch statements to get base_rent for each
            const { data: statements } = await supabase
              .from("statements")
              .select("id, base_rent, late_fee, additional_fees")
              .in("id", statementIds);
            
            const statementMap = new Map(statements?.map(s => [s.id, s]) || []);
            
            // Sum only the base rent portion (excluding late fees, additional fees, and platform fees)
            // Use proportion calculation: base_rent / statementTotal * statement_amount
            const totalBasePaid = yearPayments.reduce((sum, p) => {
              if (p.statement_id && statementMap.has(p.statement_id)) {
                const statement = statementMap.get(p.statement_id)!;
                const baseRent = Number(statement.base_rent);
                const lateFee = Number(statement.late_fee || 0);
                const additionalFees = Number(statement.additional_fees || 0);
                const statementTotal = baseRent + lateFee + additionalFees;
                
                if (p.statement_amount !== null && p.statement_amount !== undefined && statementTotal > 0) {
                  // Calculate proportion: base_rent / statementTotal
                  // Then multiply by statement_amount to get base rent portion paid
                  const proportion = baseRent / statementTotal;
                  const baseRentPaid = Number(p.statement_amount) * proportion;
                  
                  console.log("[Total Paid This Year] Payment calculation:", {
                    statement_id: p.statement_id,
                    statement_amount: p.statement_amount,
                    base_rent: baseRent,
                    late_fee: lateFee,
                    additional_fees: additionalFees,
                    statementTotal: statementTotal,
                    proportion: proportion,
                    baseRentPaid: baseRentPaid
                  });
                  
                  return sum + baseRentPaid;
                }
              }
              return sum;
            }, 0);
            const roundedTotal = Math.round(totalBasePaid * 100) / 100;
            console.log("[Total Paid This Year] Final total:", roundedTotal);
            setTotalPaid(roundedTotal);
          } else {
            setTotalPaid(0);
          }

          // Calculate remaining balance for current statement after partial payments
          if (currentStatement && unitData) {
            // Fetch all completed payments for this statement
            const { data: statementPayments } = await supabase
              .from("payments")
              .select("amount, fee_amount, statement_id, statement_amount, created_at")
              .eq("statement_id", currentStatement.id)
              .eq("status", "completed")
              .order("created_at", { ascending: true }); // Oldest first

            if (statementPayments && statementPayments.length > 0) {
              const statementTotalDue = Number(currentStatement.total_due);
              
              // Sum all statement_amount values (amount applied to statement, excluding platform fees)
              // Formula: remaining = total_due - sum(statement_amount for all payments)
              const totalPaidToStatement = statementPayments.reduce((sum, p) => {
                if (p.statement_amount !== null && p.statement_amount !== undefined) {
                  const amount = Number(p.statement_amount);
                  console.log("[Total Rent Due] Payment contribution:", {
                    payment_id: p.id || 'unknown',
                    statement_amount: amount,
                    running_total: sum + amount
                  });
                  return sum + amount;
                } else {
                  // Fallback for old payments without statement_amount
                  // For old payments, we can't accurately calculate, so skip them
                  // This should rarely happen after migration
                  console.warn("[Total Rent Due] Payment missing statement_amount, skipping:", p);
                  return sum;
                }
              }, 0);

              const remaining = Math.max(0, statementTotalDue - totalPaidToStatement);
              console.log("[Total Rent Due] Calculation:", {
                statement_id: currentStatement.id,
                statement_total_due: statementTotalDue,
                total_paid_to_statement: totalPaidToStatement,
                remaining_balance: remaining
              });
              setRemainingBalance(remaining);
            } else {
              // No payments made yet, remaining balance = total_due
              console.log("[Total Rent Due] No payments yet, using total_due:", currentStatement.total_due);
              setRemainingBalance(Number(currentStatement.total_due));
            }
          } else {
            setRemainingBalance(null);
          }
        }

        // Calculate payment streak
        const calculatePaymentStreak = async () => {
          // Get all completed payments with their statements, ordered chronologically (oldest first)
          const { data: allPayments } = await supabase
            .from("payments")
            .select(`
              id,
              paid_at,
              statement_id,
              statements!inner(
                id,
                period_month,
                status
              )
            `)
            .eq("unit_id", unitData.id)
            .eq("status", "completed")
            .not("paid_at", "is", null)
            .order("paid_at", { ascending: true }); // Oldest first for chronological processing

          if (!allPayments || allPayments.length === 0) {
            setPaymentStreak(null); // No payments = show dashes
            return;
          }

          // Calculate streak chronologically (oldest to newest)
          // Each on-time payment increments the streak
          // A late payment resets the streak to 1
          let streak = 0;

          for (const payment of allPayments) {
            const statement = Array.isArray(payment.statements) ? payment.statements[0] : payment.statements;
            if (!statement || !payment.paid_at) continue;

            // Parse statement period_month to get due date
            const [month, year] = statement.period_month.split('/').map(Number);
            const dueDate = new Date(year, month - 1, unitData.due_day);
            const paidDate = parseISO(payment.paid_at);

            // Payment is on-time if paid on or before due date
            const isOnTime = paidDate <= dueDate;

            if (isOnTime) {
              // On-time payment: increment streak
              streak++;
            } else {
              // Late payment: reset streak to 1
              streak = 1;
            }
          }

          // If we have payments, streak should be at least 1 (even if all were late)
          // But if no payments exist, streak is null
          setPaymentStreak(streak > 0 ? streak : null);
        };

        await calculatePaymentStreak();
      } else {
        console.warn("[TenantDashboard] No unit found for tenant_id:", user.id);
        // Show helpful error message
        if (profileData) {
          console.log("[TenantDashboard] Tenant profile exists but no unit assigned. Profile:", profileData);
          toast.error("No unit assigned. Please contact your landlord to assign you to a unit.");
        }
      }
    } catch (error) {
      console.error("[TenantDashboard] Error fetching tenant data:", error);
      toast.error("Failed to load tenant data. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTenantData();
    }
  }, [user, fetchTenantData]);

  // Handle payment redirects from Stripe
  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    const statementId = searchParams.get("statement_id");
    
    if (paymentStatus === "success") {
      toast.success("Payment successful! Your payment is being processed.");
      
      // Refresh data immediately
      if (user) {
        fetchTenantData();
      }
      
      // Poll for payment status updates (webhook may take a few seconds)
      if (statementId && user) {
        let pollCount = 0;
        const maxPolls = 10; // Poll for up to 10 seconds (10 * 1 second intervals)
        
        const pollInterval = setInterval(async () => {
          pollCount++;
          
          try {
            // Check if statement status has been updated to "paid"
            const { data: statement } = await supabase
              .from("statements")
              .select("status")
              .eq("id", statementId)
              .single();
            
            // Check if payment has been marked as completed
            const { data: payments } = await supabase
              .from("payments")
              .select("status, statement_id")
              .eq("statement_id", statementId)
              .eq("status", "completed")
              .limit(1);
            
            // If statement is paid or payment is completed, refresh and stop polling
            if (statement?.status === "paid" || (payments && payments.length > 0)) {
              clearInterval(pollInterval);
              fetchTenantData();
              toast.success("Payment confirmed! Your statement has been updated.");
            } else if (pollCount >= maxPolls) {
              // Stop polling after max attempts
              clearInterval(pollInterval);
              // Still refresh in case webhook is just slow
              fetchTenantData();
            }
          } catch (error) {
            console.error("Error polling payment status:", error);
            if (pollCount >= maxPolls) {
              clearInterval(pollInterval);
            }
          }
        }, 1000); // Poll every second
        
        // Cleanup interval on unmount
        return () => clearInterval(pollInterval);
      }
      
      // Clear the query parameter
      searchParams.delete("payment");
      searchParams.delete("statement_id");
      setSearchParams(searchParams, { replace: true });
    } else if (paymentStatus === "cancelled") {
      toast.error("Payment was cancelled. You can try again anytime.");
      // Clear the query parameter
      searchParams.delete("payment");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, user, fetchTenantData]);

  const getNextDueDate = () => {
    if (!unit) return null;
    const today = new Date();
    const dueDate = new Date(today.getFullYear(), today.getMonth(), unit.due_day);
    if (dueDate < today) {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }
    return dueDate;
  };

  const getDaysUntilDue = () => {
    const nextDue = getNextDueDate();
    if (!nextDue) return 0;
    return differenceInDays(nextDue, new Date());
  };

  const isPastDue = () => {
    if (!unit || !currentStatement) return false;
    if (currentStatement.status === "paid") return false;
    
    const today = startOfDay(new Date());
    const [month, year] = currentStatement.period_month.split('/').map(Number);
    const dueDate = startOfDay(new Date(year, month - 1, unit.due_day));
    
    // If the due date hasn't arrived yet, it's not past due (regardless of status)
    if (today < dueDate) {
      return false;
    }
    
    // If first_month_paid is true, check if we're showing a future month's statement
    if (unit.first_month_paid) {
      const currentMonth = format(new Date(), "MM/yyyy");
      const [statementMonth, statementYear] = currentStatement.period_month.split('/').map(Number);
      const [currentMonthNum, currentYear] = currentMonth.split('/').map(Number);
      
      // If the statement is for a future month, it's not past due
      if (statementYear > currentYear || (statementYear === currentYear && statementMonth > currentMonthNum)) {
        return false;
      }
    }
    
    // Only return true if the due date has passed
    return today > dueDate;
  };

  const canMakePayment = () => {
    // If no statement exists but unit exists, allow payment (will generate statement on click)
    if (!unit) return false;
    if (!currentStatement) return true; // Allow payment to trigger statement generation
    
    if (currentStatement.status === "paid") return false;
    
    // Can always pay if past due
    if (isPastDue()) return true;
    
    // Calculate due date for the current statement's period
    const today = startOfDay(new Date());
    const [month, year] = currentStatement.period_month.split('/');
    const statementDueDate = startOfDay(new Date(parseInt(year), parseInt(month) - 1, unit.due_day));
    
    // Calculate days until due date (can be negative if past due, but we already checked isPastDue)
    const daysUntilDue = differenceInDays(statementDueDate, today);
    
    // If balance is up to date (not past due), only allow payment within 3 days of due date
    // This means: daysUntilDue must be <= 3 (3 days before, on due date, or after)
    // But since we already checked isPastDue() above, if we get here, we're not past due
    // So we only allow if daysUntilDue <= 3
    return daysUntilDue <= 3;
  };

  const handleQuickAction = (label: string) => {
    switch (label) {
      case "Documents":
        setDocumentsModalOpen(true);
        break;
      case "Maintenance":
        setMaintenanceModalOpen(true);
        break;
      case "Contact":
        setContactModalOpen(true);
        break;
      case "Settings":
        setSettingsModalOpen(true);
        break;
      case "Help":
        setHelpModalOpen(true);
        break;
      default:
        break;
    }
  };

  const quickActions = [
    { label: "Documents", icon: FileText, action: () => handleQuickAction("Documents") },
    { label: "Maintenance", icon: Wrench, action: () => handleQuickAction("Maintenance") },
    { label: "Contact", icon: MessageSquare, action: () => handleQuickAction("Contact") },
    { label: "Settings", icon: Settings, action: () => handleQuickAction("Settings") },
    { label: "Help", icon: HelpCircle, action: () => handleQuickAction("Help") },
  ];

  const daysUntilDue = getDaysUntilDue();
  const nextDueDate = getNextDueDate();
  const pastDue = isPastDue();
  // Use remaining balance if available, otherwise fall back to total_due
  const rentDue = remainingBalance !== null ? remainingBalance : (currentStatement?.total_due || unit?.monthly_rent || 0);
  const canPay = canMakePayment();
  
  // Calculate days until payment is available (for button text)
  const getDaysUntilPaymentAvailable = () => {
    if (!currentStatement || !unit || currentStatement.status === "paid") return null;
    if (pastDue) return null; // Can always pay if past due
    const today = startOfDay(new Date());
    const [month, year] = currentStatement.period_month.split('/');
    const statementDueDate = startOfDay(new Date(parseInt(year), parseInt(month) - 1, unit.due_day));
    const daysUntilDue = differenceInDays(statementDueDate, today);
    return daysUntilDue > 3 ? daysUntilDue - 3 : null;
  };
  const daysUntilPaymentAvailable = getDaysUntilPaymentAvailable();

  // Calculate late fee breakdown
  const calculateLateFeeBreakdown = () => {
    if (!currentStatement || !unit || currentStatement.status === "paid") {
      return { flatFee: 0, dailyFee: 0 };
    }
    if (!currentStatement.period_month) {
      return { flatFee: 0, dailyFee: 0 };
    }
    
    const today = new Date();
    const [month, year] = currentStatement.period_month.split('/');
    const dueDate = new Date(parseInt(year), parseInt(month) - 1, unit.due_day);
    
    // Normalize dates to start of day for accurate calculation
    const todayStart = startOfDay(today);
    const dueDateStart = startOfDay(dueDate);
    
    if (todayStart <= dueDateStart) {
      return { flatFee: 0, dailyFee: 0 };
    }
    
    const daysLate = differenceInDays(todayStart, dueDateStart);
    
    // Calculate flat late fee (one-time fee) from unit settings
    let flatFee = 0;
    if (unit.late_fee_type === 'flat' && unit.late_fee_amount) {
      flatFee = Number(unit.late_fee_amount);
    } else if (unit.late_fee_type === 'percent' && unit.late_fee_amount) {
      flatFee = (Number(currentStatement.base_rent) * Number(unit.late_fee_amount)) / 100;
    }
    
    // Daily late fee applies from day 1 (first day after due date)
    const daysForDailyFee = Math.max(0, daysLate);
    const dailyLateFeeRate = Number(unit.daily_late_fee || 0);
    const dailyFee = daysForDailyFee * dailyLateFeeRate;
    
    // Debug logging
    console.log("[TenantDashboard] Late fee calculation:", {
      periodMonth: currentStatement.period_month,
      dueDay: unit.due_day,
      dueDate: dueDateStart.toISOString(),
      today: todayStart.toISOString(),
      daysLate,
      daysForDailyFee,
      dailyLateFeeRate,
      calculatedDailyFee: dailyFee,
      flatFee,
      unitDailyLateFee: unit.daily_late_fee,
      lateFeeType: unit.late_fee_type,
      lateFeeAmount: unit.late_fee_amount
    });
    
    return { flatFee, dailyFee };
  };

  const { flatFee, dailyFee } = calculateLateFeeBreakdown();

  if (loading) {
    return (
      <TenantLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Hero Payment Card */}
        <Card className={`relative overflow-hidden p-8 ${pastDue ? 'bg-destructive' : 'bg-primary'}`}>
          <div className="relative z-10">
            {/* Status Badge - Only show if unit exists */}
            {unit && (
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm mb-4 ${
                pastDue 
                  ? 'bg-destructive-foreground/20 text-destructive-foreground' 
                  : 'bg-primary-foreground/20 text-primary-foreground'
              }`}>
                <span className={`h-2 w-2 rounded-full ${pastDue ? 'bg-destructive-foreground' : 'bg-accent'} animate-pulse`} />
                {pastDue 
                  ? `⚠️ Account Past Due` 
                  : daysUntilDue > 0 
                    ? `Next payment in ${daysUntilDue} days` 
                    : daysUntilDue === 0 
                      ? "Payment due today" 
                      : `Payment overdue by ${Math.abs(daysUntilDue)} days`}
              </div>
            )}

            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <p className={`text-sm mb-1 ${pastDue ? 'text-destructive-foreground/70' : 'text-primary-foreground/70'}`}>
                  {pastDue ? 'Past Due Balance' : 'Total Rent Due'}
                </p>
                <p className={`text-5xl font-bold tracking-tight ${pastDue ? 'text-destructive-foreground' : 'text-primary-foreground'}`}>
                  ${rentDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                {pastDue ? (
                  <div className="flex items-center gap-2 mt-3 text-destructive-foreground/80 text-sm">
                    <Clock className="h-4 w-4" />
                    <span>Please make payment immediately to avoid additional fees</span>
                  </div>
                ) : (
                  paymentStreak !== null && (
                    <div className="flex items-center gap-2 mt-3 text-primary-foreground/80 text-sm">
                      <TrendingUp className="h-4 w-4" />
                      <span>
                        On-time payment streak: {paymentStreak} {paymentStreak === 1 ? 'month' : 'months'}
                      </span>
                    </div>
                  )
                )}
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 border-0"
                  onClick={async () => {
                    if (!currentStatement && unit) {
                      // If no statement exists, generate one first
                      const currentMonth = format(new Date(), "MM/yyyy");
                      try {
                        toast.loading("Generating statement...");
                        const { error } = await supabase.functions.invoke("generate-statement", {
                          body: { unit_id: unit.id, period_month: currentMonth }
                        });
                        toast.dismiss();
                        if (!error) {
                          // Refresh data and then open payment modal
                          await fetchTenantData();
                          setPaymentModalOpen(true);
                        } else {
                          toast.error("Please wait for your statement to be generated");
                        }
                      } catch (err) {
                        toast.dismiss();
                        toast.error("Failed to generate statement");
                      }
                    } else {
                      setPaymentModalOpen(true);
                    }
                  }}
                  disabled={!canPay || !unit || currentStatement?.status === "paid"}
                >
                  {currentStatement?.status === "paid" 
                    ? "Paid" 
                    : !canPay && daysUntilPaymentAvailable !== null
                    ? `Pay (Available in ${daysUntilPaymentAvailable} days)`
                    : "Pay"}
                  {canPay && currentStatement?.status !== "paid" && (
                    <ExternalLink className="ml-2 h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Fee Breakdown */}
            {currentStatement && (
              <div className={`grid grid-cols-2 sm:grid-cols-4 gap-6 mt-8 pt-6 border-t ${
                pastDue ? 'border-destructive-foreground/20' : 'border-primary-foreground/20'
              }`}>
                <div>
                  <p className={`text-xs uppercase tracking-wide mb-1 ${pastDue ? 'text-destructive-foreground/60' : 'text-primary-foreground/60'}`}>Base Rent</p>
                  <p className={`text-xl font-semibold ${pastDue ? 'text-destructive-foreground' : 'text-primary-foreground'}`}>
                    ${Number(currentStatement.base_rent).toLocaleString()}
                  </p>
                </div>
                {Number(currentStatement.additional_fees) > 0 && (
                  <div>
                    <p className={`text-xs uppercase tracking-wide mb-1 ${pastDue ? 'text-destructive-foreground/60' : 'text-primary-foreground/60'}`}>Utilities</p>
                    <p className={`text-xl font-semibold ${pastDue ? 'text-destructive-foreground' : 'text-primary-foreground'}`}>
                      ${Number(currentStatement.additional_fees).toLocaleString()}
                    </p>
                  </div>
                )}
                {flatFee > 0 && (
                  <div>
                    <p className={`text-xs uppercase tracking-wide mb-1 ${pastDue ? 'text-destructive-foreground/60' : 'text-primary-foreground/60'}`}>Flat Fee</p>
                    <p className={`text-xl font-semibold ${pastDue ? 'text-destructive-foreground' : 'text-primary-foreground'}`}>
                      ${flatFee.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
                {dailyFee > 0 && (
                  <div>
                    <p className={`text-xs uppercase tracking-wide mb-1 ${pastDue ? 'text-destructive-foreground/60' : 'text-primary-foreground/60'}`}>
                      Daily Late Fee
                      {unit.daily_late_fee && Number(unit.daily_late_fee) > 0 && (
                        <span className="normal-case font-normal ml-1">
                          (${Number(unit.daily_late_fee).toFixed(2)}/day)
                        </span>
                      )}
                    </p>
                    <p className={`text-xl font-semibold ${pastDue ? 'text-destructive-foreground' : 'text-primary-foreground'}`}>
                      ${dailyFee.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
                {Number(currentStatement.split_fee) > 0 && (
                  <div>
                    <p className={`text-xs uppercase tracking-wide mb-1 ${pastDue ? 'text-destructive-foreground/60' : 'text-primary-foreground/60'}`}>Split Fee</p>
                    <p className={`text-xl font-semibold ${pastDue ? 'text-destructive-foreground' : 'text-primary-foreground'}`}>
                      ${Number(currentStatement.split_fee).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Decorative background */}
          <div className={`absolute inset-0 bg-gradient-to-br ${
            pastDue 
              ? 'from-destructive via-destructive to-destructive/80' 
              : 'from-primary via-primary to-primary/80'
          }`} />
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-muted">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">Total Paid This Year</p>
            <p className="text-2xl font-bold text-foreground">
              ${totalPaid.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {recentPayments.filter(p => p.status === "completed").length} payments completed
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-muted">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">Payment Streak</p>
            <p className="text-2xl font-bold text-foreground">
              {paymentStreak !== null ? `${paymentStreak} ${paymentStreak === 1 ? 'month' : 'months'}` : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {paymentStreak !== null ? 'On-time payments' : 'No payments yet'}
            </p>
          </Card>

          <Card className={`p-5 ${pastDue ? 'border-destructive/50 bg-destructive/5' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg ${pastDue ? 'bg-destructive/10' : 'bg-muted'}`}>
                <Calendar className={`h-5 w-5 ${pastDue ? 'text-destructive' : 'text-muted-foreground'}`} />
              </div>
              {pastDue && (
                <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded">
                  PAST DUE
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-1">Next Due Date</p>
            <p className={`text-2xl font-bold ${pastDue ? 'text-destructive' : 'text-foreground'}`}>
              {nextDueDate ? format(nextDueDate, "MMM d") : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {daysUntilDue > 0 ? `In ${daysUntilDue} days` : daysUntilDue === 0 ? "Due today" : "Due soon"}
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-muted">
                <Home className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">Properties</p>
            <p className="text-2xl font-bold text-foreground">1</p>
            <p className="text-xs text-muted-foreground mt-1">Active rental</p>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {quickActions.map((action) => (
              <Card 
                key={action.label}
                className="p-4 hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={'action' in action ? action.action : undefined}
              >
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="p-3 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                    <action.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    {action.label}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Property & Transactions */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* My Property */}
          {unit && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">My Property</h2>
                <Button variant="link" className="text-primary p-0 h-auto">
                  View Details
                </Button>
              </div>
              <Card className="overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300">
                <div className="aspect-video relative bg-gradient-to-br from-primary via-primary/80 to-accent">
                  {/* Decorative geometric patterns */}
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-4 right-4 w-24 h-24 rounded-full border-2 border-primary-foreground/30" />
                    <div className="absolute top-8 right-8 w-16 h-16 rounded-full border border-primary-foreground/20" />
                    <div className="absolute bottom-16 right-12 w-8 h-8 rounded-full bg-primary-foreground/10" />
                    <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-primary-foreground/5 blur-2xl" />
                  </div>
                  
                  {/* Abstract shapes */}
                  <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary-foreground/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-foreground/60 to-transparent" />
                  
                  {/* Grid pattern */}
                  <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: 'radial-gradient(circle, hsl(var(--primary-foreground)) 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                  }} />

                  <div className="absolute bottom-4 left-4 text-primary-foreground z-10">
                    <h3 className="font-semibold text-lg">{unit.property?.name || "Your Property"}</h3>
                    {unit.property?.address && (
                      <div className="flex items-center gap-1 text-sm opacity-80 mt-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {unit.property.address}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-sm mt-2">
                      <span className="flex items-center gap-1">
                        <Home className="h-3.5 w-3.5" />
                        Unit {unit.unit_number}
                      </span>
                      {unit.allow_split_payment && (
                        <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30">
                          Split Payments Allowed
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Recent Transactions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Recent Transactions</h2>
              <Button variant="link" className="text-primary px-2 py-1" asChild>
                <Link to="/tenant/payments">
                  View All
                </Link>
              </Button>
            </div>
            <Card className="divide-y divide-border">
              {recentPayments.length > 0 ? (
                recentPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${
                        payment.status === "completed" 
                          ? "bg-primary/10 text-primary" 
                          : "bg-accent/10 text-accent"
                      }`}>
                        {payment.status === "completed" ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {payment.status === "completed" ? "Rent Payment" : "Pending Payment"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payment.paid_at 
                            ? format(parseISO(payment.paid_at), "MMM d, yyyy")
                            : format(parseISO(payment.created_at), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${
                        payment.status === "completed" ? "text-foreground" : "text-accent"
                      }`}>
                        -${Number(payment.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-sm">No transactions yet</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        statement={currentStatement}
        allowSplitPayment={unit?.allow_split_payment || false}
        splitPaymentFee={unit?.split_payment_fee || null}
      />

      {/* Documents Modal */}
      <DocumentsModal
        open={documentsModalOpen}
        onOpenChange={setDocumentsModalOpen}
        leaseUrl={unit?.lease_pdf_url}
        unitId={unit?.id}
      />

      {/* Maintenance Modal */}
      <MaintenanceModal
        open={maintenanceModalOpen}
        onOpenChange={setMaintenanceModalOpen}
        unitNumber={unit?.unit_number || ""}
        propertyName={unit?.property?.name || ""}
        tenantName={tenantProfile?.full_name || ""}
        tenantEmail={tenantProfile?.email || ""}
      />

      {/* Contact Modal */}
      <ContactModal
        open={contactModalOpen}
        onOpenChange={setContactModalOpen}
        unitNumber={unit?.unit_number || ""}
        propertyName={unit?.property?.name || ""}
        tenantName={tenantProfile?.full_name || ""}
        tenantEmail={tenantProfile?.email || ""}
      />

      {/* Settings Modal */}
      <TenantSettingsModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        currentEmail={tenantProfile?.email || user?.email || ""}
      />

      {/* Help Modal */}
      <HelpModal
        open={helpModalOpen}
        onOpenChange={setHelpModalOpen}
        tenantName={tenantProfile?.full_name || ""}
        tenantEmail={tenantProfile?.email || ""}
      />
    </TenantLayout>
  );
}
