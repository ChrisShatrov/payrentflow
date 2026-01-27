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
  move_in_date?: string | null;
  property: {
    name: string;
    address: string;
    allow_maintenance_requests?: boolean;
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
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(true);

  // Helper function to calculate pro-rated rent (same logic as generate-statement)
  const calculateProratedRent = useCallback((moveInDate: Date | null, periodMonth: string, monthlyRent: number): number => {
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
  }, []);

  // Helper function to determine if rent is prorated
  const isProratedRent = useCallback((baseRent: number, monthlyRent: number | null | undefined): boolean => {
    if (!monthlyRent) return false;
    // Consider it prorated if base_rent is at least 1% different from monthly_rent
    // This accounts for rounding differences
    const difference = Math.abs(baseRent - monthlyRent);
    return difference > (monthlyRent * 0.01);
  }, []);

  const fetchTenantData = useCallback(async () => {
    try {
      if (!user?.id) {
        console.error("[TenantDashboard] No user ID available");
        return;
      }

      console.log("[TenantDashboard] Fetching data for user:", user.id);

      // Fetch tenant profile
      // Use auth.getUser() to get profile data from auth metadata as fallback
      const { data: { user: authUserData } } = await supabase.auth.getUser();
      console.log("[TenantDashboard] Auth user data:", authUserData);
      
      let { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, email, id, role")
        .eq("id", user.id)
        .single();
      
      console.log("[TenantDashboard] Profile data:", { 
        profileData, 
        profileError,
        errorCode: profileError?.code,
        errorMessage: profileError?.message,
        errorDetails: profileError?.details,
        errorHint: profileError?.hint
      });
      
      // If profile fetch fails with 406 or RLS error, try using auth metadata
      if (profileError && (profileError.code === 'PGRST301' || profileError.message?.includes('permission') || profileError.code === '406')) {
        console.warn("[TenantDashboard] Profile fetch blocked by RLS, using auth metadata");
        if (authUserData) {
          profileData = {
            id: authUserData.id,
            email: authUserData.email || user.email || '',
            full_name: authUserData.user_metadata?.full_name || null,
            role: authUserData.user_metadata?.role || 'tenant'
          };
          console.log("[TenantDashboard] Using auth metadata as profile:", profileData);
        }
      }
      
      // If no profile exists, try to create one from auth user data
      if (!profileData && user.email) {
        console.log("[TenantDashboard] No profile found, attempting to create one from auth user data");
        const { data: authUser } = await supabase.auth.getUser();
        
        if (authUser?.user) {
          // First, try a simple insert (will fail if profile exists, which is fine)
          const { data: newProfile, error: createError } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              email: user.email || authUser.user.email || "",
              full_name: authUser.user.user_metadata?.full_name || null,
              phone: authUser.user.user_metadata?.phone || null,
              role: authUser.user.user_metadata?.role || "tenant",
            })
            .select()
            .single();
          
          if (newProfile && !createError) {
            console.log("[TenantDashboard] Profile created successfully:", newProfile);
            profileData = newProfile;
            setTenantProfile(newProfile);
          } else {
            // If insert failed (likely because profile already exists), try to fetch it
            console.log("[TenantDashboard] Insert failed (profile may already exist), fetching:", createError);
            
            // Wait a moment for trigger to create profile (if it hasn't yet)
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const { data: retryProfile, error: fetchError } = await supabase
              .from("profiles")
              .select("full_name, email, id, role")
              .eq("id", user.id)
              .single();
            
            if (retryProfile && !fetchError) {
              console.log("[TenantDashboard] Profile found after insert attempt:", retryProfile);
              profileData = retryProfile;
              setTenantProfile(retryProfile);
            } else {
              console.warn("[TenantDashboard] Could not create or fetch profile:", { createError, fetchError });
              // Profile might be created by database trigger - continue without showing error
              // The profile will be available on next page load
            }
          }
        }
      } else if (profileData) {
        setTenantProfile(profileData);
      }

      // Fetch tenant's unit with property info
      console.log("[TenantDashboard] Querying units with tenant_id:", user.id);
      console.log("[TenantDashboard] User object:", { id: user.id, email: user.email });
      
      // First, let's check what auth.uid() returns
      const { data: { user: authUser } } = await supabase.auth.getUser();
      console.log("[TenantDashboard] Auth user ID:", authUser?.id);
      console.log("[TenantDashboard] ID comparison:", {
        useAuthId: user.id,
        authUserId: authUser?.id,
        match: user.id === authUser?.id,
        typeUseAuth: typeof user.id,
        typeAuth: typeof authUser?.id
      });
      
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
          move_in_date,
          tenant_id,
          property:properties (
            name,
            address,
            allow_maintenance_requests
          )
        `)
        .eq("tenant_id", user.id)
        .maybeSingle();

      console.log("[TenantDashboard] Unit query result:", { 
        unitData, 
        unitError,
        hasUnit: !!unitData,
        tenantId: unitData?.tenant_id,
        userId: user.id,
        errorMessage: unitError?.message,
        errorDetails: unitError?.details,
        errorHint: unitError?.hint,
        errorCode: unitError?.code
      });
      
      // If query failed, try without the filter to see if RLS is blocking
      if (unitError || !unitData) {
        console.log("[TenantDashboard] Query failed or no data, checking RLS...");
        
        // Check if auth.uid() matches our user.id
        const { data: { user: currentAuthUser } } = await supabase.auth.getUser();
        console.log("[TenantDashboard] Current auth.uid():", currentAuthUser?.id);
        console.log("[TenantDashboard] useAuth user.id:", user.id);
        console.log("[TenantDashboard] IDs match:", currentAuthUser?.id === user.id);
        
        // Try a simpler query to see if we can access units at all
        const { data: allUnits, error: allUnitsError } = await supabase
          .from("units")
          .select("id, tenant_id, unit_number")
          .limit(10);
        
        console.log("[TenantDashboard] All units query (to check RLS):", {
          allUnits,
          allUnitsError,
          count: allUnits?.length,
          errorCode: allUnitsError?.code,
          errorMessage: allUnitsError?.message
        });
        
        // If RLS is blocking everything, the issue is likely:
        // 1. The tenant_id in units table doesn't match auth.uid()
        // 2. Or there's a profile/RLS issue preventing auth.uid() from working
        if (allUnitsError || (allUnits && allUnits.length === 0)) {
          console.error("[TenantDashboard] ⚠️ RLS is blocking all unit access!");
          console.error("[TenantDashboard] This suggests:");
          console.error("  1. tenant_id in units table doesn't match auth.uid()");
          console.error("  2. Or profile doesn't exist/RLS is blocking profile access");
          console.error("[TenantDashboard] auth.uid() should be:", currentAuthUser?.id);
          console.error("[TenantDashboard] Check units table - tenant_id should match:", currentAuthUser?.id);
          console.error("[TenantDashboard] 🔧 FIX: Run the SQL script: scripts/fix-tenant-assignment.sql");
          console.error("[TenantDashboard] 🔧 Or update units table: UPDATE units SET tenant_id = '", currentAuthUser?.id, "' WHERE unit_number = '003';");
          
          // Show user-friendly error
          toast.error(
            `Unit assignment mismatch detected. Your user ID (${currentAuthUser?.id?.substring(0, 8)}...) doesn't match the tenant_id in the database. Please contact support.`,
            { duration: 10000 }
          );
        }
        
        // Check if any unit has our tenant_id (if we got any results)
        if (allUnits && allUnits.length > 0) {
          const matchingUnit = allUnits.find((u: any) => {
            const matches = u.tenant_id === user.id || u.tenant_id === currentAuthUser?.id;
            console.log("[TenantDashboard] Checking unit:", {
              unitId: u.id,
              unitTenantId: u.tenant_id,
              useAuthId: user.id,
              authUid: currentAuthUser?.id,
              matchesUseAuth: u.tenant_id === user.id,
              matchesAuthUid: u.tenant_id === currentAuthUser?.id,
              matches: matches
            });
            return matches;
          });
          console.log("[TenantDashboard] Found matching unit in all units:", matchingUnit);
          if (matchingUnit && !unitData) {
            console.error("[TenantDashboard] RLS ISSUE: Unit exists with matching tenant_id but RLS is blocking it!");
            console.error("[TenantDashboard] Unit tenant_id:", matchingUnit.tenant_id, "User ID:", user.id, "Match:", matchingUnit.tenant_id === user.id);
          }
        }
      }
      
      // If no unit found and there's an error, log it for debugging
      if (unitError) {
        console.error("[TenantDashboard] Error fetching unit:", unitError);
        console.error("[TenantDashboard] Error details:", {
          message: unitError.message,
          details: unitError.details,
          hint: unitError.hint,
          code: unitError.code
        });
      }

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
        
        // Set maintenance enabled status based on property setting
        const maintenanceAllowed = (unitData.property as any)?.allow_maintenance_requests ?? true;
        setMaintenanceEnabled(maintenanceAllowed);
        
        // Check if current month statement has a stale late fee on move-in date and regenerate if needed
        const currentMonthForRegen = format(new Date(), "MM/yyyy");
        if (unitData.move_in_date) {
          const moveInDate = new Date(unitData.move_in_date);
          const moveInMonth = format(moveInDate, "MM/yyyy");
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const moveInDateStart = new Date(moveInDate);
          moveInDateStart.setHours(0, 0, 0, 0);
          
          // If we're in the move-in month and today is the move-in date, check for stale late fees
          if (currentMonthForRegen === moveInMonth && today.getTime() === moveInDateStart.getTime()) {
            // Check if current month statement exists and has a late fee
            const { data: currentMonthCheck } = await supabase
              .from("statements")
              .select("id, late_fee, period_month")
              .eq("unit_id", unitData.id)
              .eq("period_month", currentMonthForRegen)
              .maybeSingle();
            
            if (currentMonthCheck && Number(currentMonthCheck.late_fee || 0) > 0) {
              console.log("[TenantDashboard] Detected stale late fee on move-in date, regenerating statement");
              // Regenerate statement to clear stale late fee (skip email to avoid duplicate notifications)
              try {
                await supabase.functions.invoke("generate-statement", {
                  body: { 
                    unit_id: unitData.id, 
                    period_month: currentMonthForRegen,
                    skip_email_notification: true // Skip email since this is just a correction, not a new statement
                  }
                });
                console.log("[TenantDashboard] Statement regenerated to clear stale late fee");
              } catch (error) {
                console.error("[TenantDashboard] Error regenerating statement:", error);
              }
            }
          }
        }

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
              // No unpaid statements - check if there are any statements at all
              // If all statements are paid, account is not past due
              const { data: allStatements } = await supabase
                .from("statements")
                .select("id, status, period_month")
                .eq("unit_id", unitData.id)
                .order("period_month", { ascending: false })
                .limit(10);
              
              const hasUnpaid = allStatements?.some(s => s.status !== "paid") || false;
              
              if (!hasUnpaid) {
                // All statements are paid - check if we need to generate current month's statement
                // This handles the case where January was just paid but no statement exists for current month yet
                console.log("[TenantDashboard] All statements are paid, checking if current month statement needs to be generated");
                
                // Check if current month statement exists
                const { data: currentMonthCheck } = await supabase
                  .from("statements")
                  .select("id")
                  .eq("unit_id", unitData.id)
                  .eq("period_month", currentMonth)
                  .maybeSingle();
                
                if (!currentMonthCheck) {
                  // Current month statement doesn't exist - generate it
                  console.log("[TenantDashboard] Current month statement missing, generating it");
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
                        console.log("[TenantDashboard] Generated current month statement:", newStatement.id);
                        setCurrentStatement(newStatement);
                      } else {
                        console.log("[TenantDashboard] Statement generation completed but not found");
                        setCurrentStatement(null);
                        setRemainingBalance(0);
                      }
                    } else {
                      console.log("[TenantDashboard] Could not generate statement:", generateError);
                      setCurrentStatement(null);
                      setRemainingBalance(0);
                    }
                  } catch (error) {
                    console.error("[TenantDashboard] Error generating statement:", error);
                    setCurrentStatement(null);
                    setRemainingBalance(0);
                  }
                } else {
                  // Current month statement exists - check if it's actually paid
                  const { data: currentMonthStatement } = await supabase
                    .from("statements")
                    .select("*")
                    .eq("unit_id", unitData.id)
                    .eq("period_month", currentMonth)
                    .maybeSingle();
                  
                  if (currentMonthStatement) {
                    if (currentMonthStatement.status === "paid") {
                      // Statement is paid - account is up to date
                      console.log("[TenantDashboard] Current month statement is paid, account is up to date");
                      setCurrentStatement(null);
                      setRemainingBalance(0);
                    } else {
                      // Statement exists but is unpaid - set it as current statement
                      // Calculate remaining balance immediately
                      console.log("[TenantDashboard] Current month statement exists but is unpaid:", currentMonthStatement.status);
                      setCurrentStatement(currentMonthStatement);
                      // Set initial balance from total_due (will be recalculated later with payments)
                      const initialBalance = Number(currentMonthStatement.total_due) || 0;
                      setRemainingBalance(initialBalance);
                      console.log("[TenantDashboard] Set initial remaining balance:", initialBalance);
                    }
                  } else {
                    // Statement check returned null somehow
                    console.log("[TenantDashboard] Current month statement check returned null");
                    setCurrentStatement(null);
                    setRemainingBalance(0);
                  }
                }
              } else {
                // There might be statements we missed, try to find them
                const { data: anyUnpaid } = await supabase
                  .from("statements")
                  .select("*")
                  .eq("unit_id", unitData.id)
                  .neq("status", "paid")
                  .order("period_month", { ascending: true })
                  .limit(1);
                
                if (anyUnpaid && anyUnpaid.length > 0) {
                  setCurrentStatement(anyUnpaid[0]);
                  // Calculate correct rent due (excluding stale late fees)
                  const baseAmount = Number(anyUnpaid[0].base_rent) + (Number(anyUnpaid[0].additional_fees) || 0);
                  const storedLateFee = Number(anyUnpaid[0].late_fee || 0);
                  // For initial balance, use base amount (late fees will be recalculated correctly in UI)
                  const calculatedInitialBalance = baseAmount;
                  setRemainingBalance(calculatedInitialBalance);
                  console.log("[TenantDashboard] Found unpaid statement, set initial balance:", calculatedInitialBalance, "(stored total_due:", Number(anyUnpaid[0].total_due) || 0, "includes stale late fee:", storedLateFee, ")");
                } else {
                  setCurrentStatement(null);
                  setRemainingBalance(0);
                }
              }
            }
          } else if (currentMonthStatement) {
            // Current month statement exists - check if it's effectively paid (has completed payments)
            // Even if status isn't updated to "paid" yet, check if payments cover the total
            const { data: statementPayments } = await supabase
              .from("payments")
              .select("statement_amount")
              .eq("statement_id", currentMonthStatement.id)
              .eq("status", "completed");
            
            let isEffectivelyPaid = false;
            if (statementPayments && statementPayments.length > 0) {
              const totalPaid = statementPayments.reduce((sum, p) => {
                return sum + (Number(p.statement_amount) || 0);
              }, 0);
              const totalDue = Number(currentMonthStatement.total_due) || 0;
              isEffectivelyPaid = totalPaid >= totalDue;
              
              console.log("[TenantDashboard] Checking if statement is effectively paid:", {
                statement_id: currentMonthStatement.id,
                status: currentMonthStatement.status,
                total_due: totalDue,
                total_paid: totalPaid,
                isEffectivelyPaid
              });
            }
            
            if (isEffectivelyPaid) {
              // Statement is effectively paid (payments cover total), treat as paid
              console.log("[TenantDashboard] Statement is effectively paid, looking for next unpaid statement");
              
              // Set remaining balance to 0 for this effectively paid statement
              setRemainingBalance(0);
              
              // Find the next unpaid statement
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
                // No unpaid statements - check if we need to generate current month's statement
                console.log("[TenantDashboard] No unpaid statements found, checking if current month statement needs to be generated");
                
                // Check if current month statement exists
                const { data: currentMonthCheck } = await supabase
                  .from("statements")
                  .select("id")
                  .eq("unit_id", unitData.id)
                  .eq("period_month", currentMonth)
                  .maybeSingle();
                
                if (!currentMonthCheck) {
                  // Current month statement doesn't exist - generate it
                  console.log("[TenantDashboard] Current month statement missing, generating it");
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
                        console.log("[TenantDashboard] Generated current month statement:", newStatement.id);
                        setCurrentStatement(newStatement);
                      } else {
                        console.log("[TenantDashboard] Statement generation completed but not found");
                        setCurrentStatement(null);
                        // remainingBalance is already set to 0 above
                      }
                    } else {
                      console.log("[TenantDashboard] Could not generate statement:", generateError);
                      setCurrentStatement(null);
                      // remainingBalance is already set to 0 above
                    }
                  } catch (error) {
                    console.error("[TenantDashboard] Error generating statement:", error);
                    setCurrentStatement(null);
                    // remainingBalance is already set to 0 above
                  }
                } else {
                  // Current month statement exists - check if it's actually paid
                  const { data: currentMonthStatement } = await supabase
                    .from("statements")
                    .select("*")
                    .eq("unit_id", unitData.id)
                    .eq("period_month", currentMonth)
                    .maybeSingle();
                  
                  if (currentMonthStatement) {
                    if (currentMonthStatement.status === "paid") {
                      // Statement is paid - account is up to date
                      console.log("[TenantDashboard] Current month statement is paid, account is up to date");
                      setCurrentStatement(null);
                      // remainingBalance is already set to 0 above
                    } else {
                      // Statement exists but is unpaid - set it as current statement
                      // Calculate remaining balance immediately
                      console.log("[TenantDashboard] Current month statement exists but is unpaid:", currentMonthStatement.status);
                      setCurrentStatement(currentMonthStatement);
                      // Set initial balance from total_due (will be recalculated later with payments)
                      const initialBalance = Number(currentMonthStatement.total_due) || 0;
                      setRemainingBalance(initialBalance);
                      console.log("[TenantDashboard] Set initial remaining balance:", initialBalance);
                    }
                  } else {
                    // Statement check returned null somehow
                    console.log("[TenantDashboard] Current month statement check returned null");
                    setCurrentStatement(null);
                    // remainingBalance is already set to 0 above
                  }
                }
              }
            } else {
              // Statement is not paid, set as current
              // Calculate correct rent due (excluding stale late fees)
              const baseAmount = Number(currentMonthStatement.base_rent) + (Number(currentMonthStatement.additional_fees) || 0);
              const storedLateFee = Number(currentMonthStatement.late_fee || 0);
              // For initial balance, use base amount (late fees will be recalculated correctly in UI)
              // This matches what the UI will display
              const calculatedInitialBalance = baseAmount;
              setCurrentStatement(currentMonthStatement);
              setRemainingBalance(calculatedInitialBalance);
              console.log("[TenantDashboard] Statement not paid, set initial balance:", calculatedInitialBalance, "(stored total_due:", Number(currentMonthStatement.total_due) || 0, "includes stale late fee:", storedLateFee, ")");
            }
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
            // No next month statement - statements will be auto-generated 10 days before due date
            console.log("[TenantDashboard] No next month statement found, waiting for auto-generation");
            setCurrentStatement(null);
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
            let finalTotal = totalBasePaid;
            
            // If first_month_paid is true and we're in the move-in month, add the pro-rated amount
            if (unitData.first_month_paid && unitData.move_in_date) {
              const currentMonth = format(new Date(), "MM/yyyy");
              const moveInDate = new Date(unitData.move_in_date);
              const moveInMonth = format(moveInDate, "MM/yyyy");
              
              // If we're in the move-in month, add the pro-rated amount as "paid"
              if (currentMonth === moveInMonth) {
                const proratedAmount = calculateProratedRent(moveInDate, currentMonth, unitData.monthly_rent);
                finalTotal += proratedAmount;
                console.log("[Total Paid This Year] Added first_month_paid pro-rated amount:", proratedAmount);
              }
            }
            
            const roundedTotal = Math.round(finalTotal * 100) / 100;
            console.log("[Total Paid This Year] Final total:", roundedTotal);
            setTotalPaid(roundedTotal);
          } else {
            // No payments, but check if first_month_paid should be counted
            let total = 0;
            if (unitData.first_month_paid && unitData.move_in_date) {
              const currentMonth = format(new Date(), "MM/yyyy");
              const moveInDate = new Date(unitData.move_in_date);
              const moveInMonth = format(moveInDate, "MM/yyyy");
              
              // If we're in the move-in month, add the pro-rated amount as "paid"
              if (currentMonth === moveInMonth) {
                const proratedAmount = calculateProratedRent(moveInDate, currentMonth, unitData.monthly_rent);
                total = proratedAmount;
                console.log("[Total Paid This Year] First month paid, no payments yet, total:", total);
              }
            }
            setTotalPaid(total);
          }

          // Calculate remaining balance for current statement after partial payments
          if (!currentStatement) {
            // No current statement - but check if there are any unpaid statements we might have missed
            console.log("[Total Rent Due] No current statement set, checking for any unpaid statements");
            const { data: anyUnpaidStatements } = await supabase
              .from("statements")
              .select("*")
              .eq("unit_id", unitData.id)
              .in("status", ["unpaid", "overdue", "partial"])
              .order("period_month", { ascending: true })
              .limit(1);
            
            if (anyUnpaidStatements && anyUnpaidStatements.length > 0) {
              console.log("[Total Rent Due] Found unpaid statement that wasn't set as current:", anyUnpaidStatements[0].period_month);
              setCurrentStatement(anyUnpaidStatements[0]);
              // Calculate correct rent due (excluding stale late fees)
              const baseAmount = Number(anyUnpaidStatements[0].base_rent) + (Number(anyUnpaidStatements[0].additional_fees) || 0);
              const storedLateFee = Number(anyUnpaidStatements[0].late_fee || 0);
              // For initial balance, use base amount (late fees will be recalculated correctly in UI)
              const calculatedInitialBalance = baseAmount;
              setRemainingBalance(calculatedInitialBalance);
              console.log("[Total Rent Due] Set initial balance from found statement:", calculatedInitialBalance, "(stored total_due:", Number(anyUnpaidStatements[0].total_due) || 0, "includes stale late fee:", storedLateFee, ")");
              // Continue to calculate balance below with payments
            } else {
              console.log("[Total Rent Due] No unpaid statements found, balance is 0");
              setRemainingBalance(0);
            }
          }
          
          // Calculate balance if we have a current statement
          if (currentStatement && unitData) {
            // If statement is paid, balance is 0
            if (currentStatement.status === "paid") {
              console.log("[Total Rent Due] Statement is paid, balance is 0");
              setRemainingBalance(0);
            } else {
              // Fetch all completed payments for this statement
              const { data: statementPayments } = await supabase
                .from("payments")
                .select("amount, fee_amount, statement_id, statement_amount, created_at")
                .eq("statement_id", currentStatement.id)
                .eq("status", "completed")
                .order("created_at", { ascending: true }); // Oldest first

              if (statementPayments && statementPayments.length > 0) {
                // Calculate correct base amount (excluding stale late fees)
                const baseAmount = Number(currentStatement.base_rent) + (Number(currentStatement.additional_fees) || 0);
                const storedLateFee = Number(currentStatement.late_fee || 0);
                const storedTotalDue = Number(currentStatement.total_due);
                
                // Sum all statement_amount values (amount applied to statement, excluding platform fees)
                // Formula: remaining = base_amount - sum(statement_amount for all payments)
                // Late fees will be recalculated correctly in the UI
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

                // Calculate remaining based on base amount (late fees recalculated in UI)
                const remaining = Math.max(0, baseAmount - totalPaidToStatement);
                console.log("[Total Rent Due] Calculation:", {
                  statement_id: currentStatement.id,
                  base_amount: baseAmount,
                  stored_total_due: storedTotalDue,
                  stored_late_fee: storedLateFee,
                  total_paid_to_statement: totalPaidToStatement,
                  remaining_balance: remaining,
                  note: "Late fees will be recalculated correctly in UI display"
                });
                setRemainingBalance(remaining);
              } else {
                // No payments yet - use base amount (late fees recalculated in UI)
                const baseAmount = Number(currentStatement.base_rent) + (Number(currentStatement.additional_fees) || 0);
                const storedLateFee = Number(currentStatement.late_fee || 0);
                const storedTotalDue = Number(currentStatement.total_due) || 0;
                console.log("[Total Rent Due] No payments yet, using base amount:", baseAmount, "(stored total_due:", storedTotalDue, "includes stale late fee:", storedLateFee, ")");
                setRemainingBalance(baseAmount);
                console.log("[Total Rent Due] Setting remaining balance to:", baseAmount, "from base amount (late fees will be recalculated in UI)");
              }
            }
          } else if (!currentStatement) {
            // Double-check: if we still don't have a current statement, set balance to 0
            setRemainingBalance(0);
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
          // Check if there are any units with this tenant_id (bypassing RLS check)
          // This helps debug if it's an RLS issue
          const { data: debugUnits } = await supabase
            .from("units")
            .select("id, tenant_id, unit_number")
            .eq("tenant_id", user.id);
          
          console.log("[TenantDashboard] Debug: All units with this tenant_id:", debugUnits);
          
          if (debugUnits && debugUnits.length > 0) {
            console.error("[TenantDashboard] WARNING: Units found but RLS might be blocking access!");
            toast.error("Unit found but access denied. Please refresh the page or contact support.");
          } else {
            toast.error("No unit assigned. Please contact your landlord to assign you to a unit.");
          }
        } else {
          // Profile might be created by database trigger - don't show alarming error
          // Just log and let the refresh button handle it
          console.warn("[TenantDashboard] Profile not yet available - may be created by database trigger");
          // Don't show toast - the refresh banner is enough
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
    const currentMonth = format(today, "MM/yyyy");
    
    // If no current statement (all statements paid), calculate next month's due date
    if (!currentStatement) {
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, unit.due_day);
      nextMonth.setHours(0, 0, 0, 0);
      return nextMonth;
    }
    
    // If current statement is paid, calculate next month's due date
    if (currentStatement.status === "paid") {
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, unit.due_day);
      nextMonth.setHours(0, 0, 0, 0);
      return nextMonth;
    }
    
    // If remaining balance is 0, statement is effectively paid (even if status isn't updated yet)
    // Calculate next month's due date
    if (remainingBalance !== null && remainingBalance === 0) {
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, unit.due_day);
      nextMonth.setHours(0, 0, 0, 0);
      return nextMonth;
    }
    
    // Check if we're in the move-in month
    if (unit.move_in_date) {
      const moveInDate = new Date(unit.move_in_date);
      const moveInMonth = format(moveInDate, "MM/yyyy");
      
      // If we're in the move-in month and first month is NOT paid, due date is move-in date + 1 day (24 hours after move-in)
      if (currentMonth === moveInMonth && !unit.first_month_paid) {
        const moveInDueDate = new Date(moveInDate);
        moveInDueDate.setDate(moveInDueDate.getDate() + 1); // Add 1 day (24 hours)
        moveInDueDate.setHours(0, 0, 0, 0); // Normalize to start of day
        // Return the actual due date (move-in + 1 day), even if it's in the past
        return moveInDueDate;
      }
    }
    
    // For unpaid statements, calculate due date based on statement's period_month
    if (currentStatement.period_month) {
      const [month, year] = currentStatement.period_month.split('/').map(Number);
      const dueDate = new Date(year, month - 1, unit.due_day);
      dueDate.setHours(0, 0, 0, 0);
      
      // If this due date has passed, it's for next month
      if (dueDate < today) {
        dueDate.setMonth(dueDate.getMonth() + 1);
      }
      return dueDate;
    }
    
    // Fallback: For non-move-in months or if first month is paid, use standard due day
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
    if (!unit) return false;
    
    const today = startOfDay(new Date());
    const currentMonth = format(new Date(), "MM/yyyy");
    const [currentMonthNum, currentYear] = currentMonth.split('/').map(Number);
    
    // If no current statement (all statements paid), account is not past due
    if (!currentStatement) return false;
    
    // If current statement is paid, account is not past due
    if (currentStatement.status === "paid") {
      return false;
    }
    
    // If remaining balance is 0, statement is effectively paid (even if status isn't updated yet)
    if (remainingBalance !== null && remainingBalance === 0) {
      return false;
    }
    
    // Check if we're in the move-in month
    const isMoveInMonth = unit.move_in_date && 
      currentYear === new Date(unit.move_in_date).getFullYear() && 
      currentMonthNum === new Date(unit.move_in_date).getMonth() + 1;
    
    // If first_month_paid is true and we're in move-in month, account is not past due
    if (isMoveInMonth && unit.first_month_paid) {
      return false;
    }
    
    // If no statement exists but we're in move-in month, check if move-in date + 1 day has passed
    // (This case is already handled above with !currentStatement check, but keeping for clarity)
    
    // If we have an unpaid statement, check if it's past due
    if (!currentStatement.period_month) {
      return false; // Can't determine without period_month
    }
    
    const [month, year] = currentStatement.period_month.split('/').map(Number);
    
    let dueDate: Date;
    
    if (isMoveInMonth && unit.move_in_date) {
      // For move-in month: rent is due 24 hours after move-in date (move-in date + 1 day)
      const moveInDate = startOfDay(new Date(unit.move_in_date));
      const moveInDueDate = new Date(moveInDate);
      moveInDueDate.setDate(moveInDueDate.getDate() + 1); // Add 1 day (24 hours)
      // Due date is move-in + 1 day (always, even if in the past)
      dueDate = moveInDueDate;
    } else {
      // For non-move-in months: use standard due day
      dueDate = startOfDay(new Date(year, month - 1, unit.due_day));
    }
    
    // If the due date hasn't arrived yet, it's not past due
    if (today < dueDate) {
      return false;
    }
    
    // If first_month_paid is true, check if we're showing a future month's statement
    if (unit.first_month_paid) {
      // If the statement is for a future month, it's not past due
      if (year > currentYear || (year === currentYear && month > currentMonthNum)) {
        return false;
      }
    }
    
    // Only return true if the due date has passed AND the statement is not paid
    return today > dueDate;
  };

  const canMakePayment = () => {
    // If no statement exists but unit exists, allow payment (will generate statement on click)
    if (!unit) return false;
    if (!currentStatement) return true; // Allow payment to trigger statement generation
    
    // Can always pay if past due
    if (isPastDue()) return true;
    
    // If statement is paid, check next unpaid statement's due date
    if (currentStatement.status === "paid") {
      const nextDue = getNextDueDate();
      if (!nextDue) return false;
      const daysUntil = differenceInDays(nextDue, new Date());
      return daysUntil <= 3; // Enable 3 days before due date
    }
    
    // For unpaid statements, check if within 3 days of due date
    const nextDue = getNextDueDate();
    if (!nextDue) return false;
    const daysUntil = differenceInDays(nextDue, new Date());
    return daysUntil <= 3; // Enable 3 days before due date
    // if (isMoveInMonth && unit.move_in_date) {
    //   // For move-in month: due date is move-in date (or today if already moved in)
    //   const moveInDate = startOfDay(new Date(unit.move_in_date));
    //   statementDueDate = moveInDate > today ? moveInDate : today;
    // } else {
    //   // Standard due date
    //   statementDueDate = startOfDay(new Date(year, month - 1, unit.due_day));
    // }
    
    // // Calculate days until due date (can be negative if past due, but we already checked isPastDue)
    // const daysUntilDue = differenceInDays(statementDueDate, today);
    
    // // If balance is up to date (not past due), only allow payment within 3 days of due date
    // // This means: daysUntilDue must be <= 3 (3 days before, on due date, or after)
    // // But since we already checked isPastDue() above, if we get here, we're not past due
    // // So we only allow if daysUntilDue <= 3
    // return daysUntilDue <= 3;
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
    ...(maintenanceEnabled ? [{ label: "Maintenance", icon: Wrench, action: () => handleQuickAction("Maintenance") }] : []),
    { label: "Contact", icon: MessageSquare, action: () => handleQuickAction("Contact") },
    { label: "Settings", icon: Settings, action: () => handleQuickAction("Settings") },
    { label: "Help", icon: HelpCircle, action: () => handleQuickAction("Help") },
  ];

  const daysUntilDue = getDaysUntilDue();
  const nextDueDate = getNextDueDate();
  const pastDue = isPastDue();
  
  const canPay = canMakePayment();
  
  // Calculate days until payment is available (for button text)
  const getDaysUntilPaymentAvailable = () => {
    if (!currentStatement || !unit || currentStatement.status === "paid") return null;
    if (pastDue) return null; // Can always pay if past due
    
    // DEMO MODE: Payment is always available (return null means available now)
    // TODO: Remove this for production - restore the 3-day restriction
    return null;
    
    // const today = startOfDay(new Date());
    // const [month, year] = currentStatement.period_month.split('/').map(Number);
    // const currentMonth = format(new Date(), "MM/yyyy");
    // const [currentMonthNum, currentYear] = currentMonth.split('/').map(Number);
    
    // // Check if this is the move-in month
    // const isMoveInMonth = unit.move_in_date &&
    //   year === currentYear &&
    //   month === currentMonthNum;

    // let statementDueDate: Date;
    // if (isMoveInMonth && unit.move_in_date) {
    //   // For move-in month: due date is move-in date (or today if already moved in)
    //   const moveInDate = startOfDay(new Date(unit.move_in_date));
    //   statementDueDate = moveInDate > today ? moveInDate : today;
    // } else {
    //   // Standard due date
    //   statementDueDate = startOfDay(new Date(year, month - 1, unit.due_day));
    // }
    
    // const daysUntilDue = differenceInDays(statementDueDate, today);
    // return daysUntilDue > 3 ? daysUntilDue - 3 : null;
  };
  const daysUntilPaymentAvailable = getDaysUntilPaymentAvailable();

  // Calculate late fee breakdown
  // Always calculate based on current date and move-in date logic, not stored values
  // This ensures late fees are never shown when they shouldn't apply (e.g., on move-in date)
  const calculateLateFeeBreakdown = () => {
    if (!currentStatement || !unit || currentStatement.status === "paid") {
      return { flatFee: 0, dailyFee: 0, totalLateFee: 0 };
    }
    
    // Cannot calculate without period_month
    if (!currentStatement.period_month) {
      return { flatFee: 0, dailyFee: 0, totalLateFee: 0 };
    }
    
    const today = new Date();
    const [month, year] = currentStatement.period_month.split('/');
    
    // Check if this is the move-in month
    const isMoveInMonth = unit.move_in_date && 
      parseInt(year) === new Date(unit.move_in_date).getFullYear() &&
      parseInt(month) === new Date(unit.move_in_date).getMonth() + 1;
    
    // Calculate due date: move-in month uses move-in date + 1 day, otherwise standard due day
    let dueDate: Date;
    if (isMoveInMonth && unit.move_in_date) {
      // For move-in month: rent is due 24 hours after move-in date (move-in date + 1 day)
      const moveInDate = startOfDay(new Date(unit.move_in_date));
      const moveInDueDate = new Date(moveInDate);
      moveInDueDate.setDate(moveInDueDate.getDate() + 1); // Add 1 day (24 hours)
      dueDate = moveInDueDate;
    } else {
      // Standard due date
      dueDate = new Date(parseInt(year), parseInt(month) - 1, unit.due_day);
    }
    
    // Normalize dates to start of day for accurate calculation
    const todayStart = startOfDay(today);
    const dueDateStart = startOfDay(dueDate);
    
    // If today is the move-in date, no late fees should apply
    if (isMoveInMonth && unit.move_in_date) {
      const moveInDateStart = startOfDay(new Date(unit.move_in_date));
      
      // If today is the move-in date, no late fees
      if (todayStart.getTime() === moveInDateStart.getTime()) {
        return { flatFee: 0, dailyFee: 0, totalLateFee: 0 };
      }
    }
    
    // If not past due date, no late fees
    if (todayStart <= dueDateStart) {
      return { flatFee: 0, dailyFee: 0, totalLateFee: 0 };
    }
    
    const daysLate = differenceInDays(todayStart, dueDateStart);
    
    // Calculate flat late fee (one-time fee) from unit settings
    let flatFee = 0;
    if (unit.late_fee_type === 'flat' && unit.late_fee_amount) {
      flatFee = Number(unit.late_fee_amount);
    } else if (unit.late_fee_type === 'percent' && unit.late_fee_amount) {
      flatFee = (Number(currentStatement.base_rent) * Number(unit.late_fee_amount)) / 100;
    }
    
    // Daily late fee applies starting from day 2 (daysLate - 1)
    // Daily fee only applies for days after the first day
    const daysForDailyFee = Math.max(0, daysLate - 1);
    const dailyLateFeeRate = Number(unit.daily_late_fee || 0);
    const dailyFee = daysForDailyFee * dailyLateFeeRate;
    
    const calculatedTotal = flatFee + dailyFee;
    
    // Debug logging
    const statementLateFee = Number(currentStatement.late_fee || 0);
    console.log("[TenantDashboard] Late fee calculation:", {
      periodMonth: currentStatement.period_month,
      storedLateFee: statementLateFee,
      calculatedLateFee: calculatedTotal,
      dueDay: unit.due_day,
      dueDate: dueDateStart.toISOString(),
      today: todayStart.toISOString(),
      daysLate,
      daysForDailyFee,
      dailyLateFeeRate,
      calculatedDailyFee: dailyFee,
      flatFee,
      calculatedTotal,
      unitDailyLateFee: unit.daily_late_fee,
      lateFeeType: unit.late_fee_type,
      lateFeeAmount: unit.late_fee_amount
    });
    
    return { flatFee, dailyFee, totalLateFee: calculatedTotal };
  };

  // Calculate late fee breakdown (needed for rentDue calculation)
  const { flatFee, dailyFee, totalLateFee } = calculateLateFeeBreakdown();
  
  // Calculate rent due amount
  // Recalculate total using calculated late fees (not stored values) to ensure accuracy
  let rentDue = 0;
  if (!currentStatement) {
    // No current statement means all statements are paid or none exist yet
    rentDue = 0;
  } else if (currentStatement.status === "paid") {
    rentDue = 0; // Paid statement has no balance
  } else {
    // Recalculate total due using calculated late fees (accounts for move-in date)
    // This ensures we don't use stale late fees from the database
    const baseAmount = Number(currentStatement.base_rent) + (Number(currentStatement.additional_fees) || 0);
    const calculatedLateFee = totalLateFee; // From calculateLateFeeBreakdown()
    const recalculatedTotal = baseAmount + calculatedLateFee;
    
    // If we have remainingBalance (after payments), use that but adjust for calculated late fee
    if (remainingBalance !== null) {
      // Recalculate: remaining = (base + calculated late fee) - payments
      // We need to adjust remainingBalance to account for the difference between stored and calculated late fees
      const storedLateFee = Number(currentStatement.late_fee || 0);
      const lateFeeDifference = calculatedLateFee - storedLateFee;
      rentDue = Math.max(0, remainingBalance + lateFeeDifference);
    } else {
      // No payments yet, use recalculated total
      rentDue = recalculatedTotal;
    }
    
    // Fallback: if calculation fails, use statement total_due
    if (rentDue === 0 && currentStatement.total_due > 0 && calculatedLateFee === 0) {
      // If calculated late fee is 0 but statement has total_due, recalculate without late fee
      rentDue = baseAmount;
    }
  }

  if (loading) {
    return (
      <TenantLayout onOpenSettings={() => setSettingsModalOpen(true)}>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout onOpenSettings={() => setSettingsModalOpen(true)}>
      <div className="space-y-8 animate-fade-in">
        {/* Refresh button for debugging */}
        {!unit && (
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
            <div>
              <p className="text-sm font-medium">No unit assigned</p>
              <p className="text-xs text-muted-foreground mt-1">
                If your landlord just assigned you to a unit, try refreshing the page.
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setLoading(true);
                fetchTenantData();
              }}
            >
              Refresh
            </Button>
          </div>
        )}
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
                    // Always try to open payment modal if statement exists
                    if (currentStatement) {
                      setPaymentModalOpen(true);
                      return;
                    }
                    
                    // If no statement exists, try to generate one, but don't block the user
                    if (unit) {
                      const currentMonth = format(new Date(), "MM/yyyy");
                      try {
                        toast.loading("Generating statement...");
                        const { data, error } = await supabase.functions.invoke("generate-statement", {
                          body: { unit_id: unit.id, period_month: currentMonth }
                        });
                        toast.dismiss();
                        
                        if (error) {
                          console.error("Error generating statement:", error);
                          // Check if it's a skip error (move-in date issue)
                          if (error.message?.includes("skipped") || error.message?.includes("move-in date")) {
                            toast.error("Cannot generate statement yet. Please contact your landlord if you believe this is an error.");
                          } else {
                            toast.error(
                              error.message || "Failed to generate statement. Please try again or contact support."
                            );
                          }
                          return;
                        }
                        
                        // Refresh data and then open payment modal
                        await fetchTenantData();
                        // Wait a moment for state to update, then check if statement exists
                        // If data was returned from the function, statement was created
                        if (data) {
                          setPaymentModalOpen(true);
                        } else {
                          // Query directly to check if statement was created
                          const { data: newStatement } = await supabase
                            .from("statements")
                            .select("*")
                            .eq("unit_id", unit.id)
                            .eq("period_month", currentMonth)
                            .maybeSingle();
                          
                          if (newStatement) {
                            setCurrentStatement(newStatement);
                            setPaymentModalOpen(true);
                          } else {
                            toast.error("Statement generation completed but statement not found. Please refresh the page.");
                          }
                        }
                      } catch (err) {
                        toast.dismiss();
                        console.error("Exception generating statement:", err);
                        const errorMessage = err instanceof Error ? err.message : "Failed to generate statement";
                        toast.error(`Error: ${errorMessage}. Please check your connection and try again.`);
                      }
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
            {currentStatement && (() => {
              // Collect all fee items to render (avoid empty grid cells)
              const feeItems = [];
              
              // Base Rent - check if prorated
              const isProrated = isProratedRent(Number(currentStatement.base_rent), unit?.monthly_rent);
              if (isProrated && unit?.monthly_rent) {
                // Show both Base Rent and Prorated Rent when prorated
                feeItems.push(
                  <div key="base-rent">
                    <p className={`text-xs uppercase tracking-wide mb-1 ${pastDue ? 'text-destructive-foreground/60' : 'text-primary-foreground/60'}`}>Base Rent</p>
                    <p className={`text-xl font-semibold ${pastDue ? 'text-destructive-foreground' : 'text-primary-foreground'}`}>
                      ${Number(unit.monthly_rent).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                );
                feeItems.push(
                  <div key="prorate-rent">
                    <p className={`text-xs uppercase tracking-wide mb-1 ${pastDue ? 'text-destructive-foreground/60' : 'text-primary-foreground/60'}`}>Prorated Rent</p>
                    <p className={`text-xl font-semibold ${pastDue ? 'text-destructive-foreground' : 'text-primary-foreground'}`}>
                      ${Number(currentStatement.base_rent).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              } else {
                // Show only Base Rent when not prorated
                feeItems.push(
                  <div key="base-rent">
                    <p className={`text-xs uppercase tracking-wide mb-1 ${pastDue ? 'text-destructive-foreground/60' : 'text-primary-foreground/60'}`}>Base Rent</p>
                    <p className={`text-xl font-semibold ${pastDue ? 'text-destructive-foreground' : 'text-primary-foreground'}`}>
                      ${Number(currentStatement.base_rent).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              }
              
              // Utilities
              if (Number(currentStatement.additional_fees) > 0) {
                feeItems.push(
                  <div key="utilities">
                    <p className={`text-xs uppercase tracking-wide mb-1 ${pastDue ? 'text-destructive-foreground/60' : 'text-primary-foreground/60'}`}>Utilities</p>
                    <p className={`text-xl font-semibold ${pastDue ? 'text-destructive-foreground' : 'text-primary-foreground'}`}>
                      ${Number(currentStatement.additional_fees).toLocaleString()}
                    </p>
                  </div>
                );
              }
              
              // Only show late fees if they're actually calculated/applied (totalLateFee > 0)
              // Use calculated late fees from calculateLateFeeBreakdown() instead of stored values
              // This ensures late fees are never shown when they shouldn't apply (e.g., on move-in date)
              const isLateFeeApplied = totalLateFee > 0;
              
              // Flat Late Fee - only show if actually applied
              if (isLateFeeApplied && flatFee > 0) {
                feeItems.push(
                  <div key="flat-late-fee">
                    <p className={`text-xs uppercase tracking-wide mb-1 ${pastDue ? 'text-destructive-foreground/60' : 'text-primary-foreground/60'}`}>Flat Late Fee</p>
                    <p className={`text-xl font-semibold ${pastDue ? 'text-destructive-foreground' : 'text-primary-foreground'}`}>
                      ${flatFee.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              }
              
              // Daily Late Fee - only show if actually applied
              if (isLateFeeApplied && dailyFee > 0) {
                feeItems.push(
                  <div key="daily-late-fee">
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
                );
              }
              
              // Total Late Fee (if breakdown doesn't match) - only show if actually applied
              // This case should rarely occur, but handles edge cases where breakdown calculation differs
              if (isLateFeeApplied && totalLateFee > 0 && flatFee === 0 && dailyFee === 0) {
                feeItems.push(
                  <div key="total-late-fee">
                    <p className={`text-xs uppercase tracking-wide mb-1 ${pastDue ? 'text-destructive-foreground/60' : 'text-primary-foreground/60'}`}>Total Late Fee</p>
                    <p className={`text-xl font-semibold ${pastDue ? 'text-destructive-foreground' : 'text-primary-foreground'}`}>
                      ${totalLateFee.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              }
              
              // Split Fee
              if (Number(currentStatement.split_fee) > 0) {
                feeItems.push(
                  <div key="split-fee">
                    <p className={`text-xs uppercase tracking-wide mb-1 ${pastDue ? 'text-destructive-foreground/60' : 'text-primary-foreground/60'}`}>Split Fee</p>
                    <p className={`text-xl font-semibold ${pastDue ? 'text-destructive-foreground' : 'text-primary-foreground'}`}>
                      ${Number(currentStatement.split_fee).toLocaleString()}
                    </p>
                  </div>
                );
              }
              
              // Only render grid if we have items
              if (feeItems.length === 0) return null;
              
              // Use flexbox with wrap instead of grid to avoid empty cells
              return (
                <div className={`flex flex-wrap gap-6 mt-8 pt-6 border-t ${
                  pastDue ? 'border-destructive-foreground/20' : 'border-primary-foreground/20'
                }`}>
                  {feeItems.map(item => (
                    <div key={item.key} className="min-w-[120px]">
                      {item}
                    </div>
                  ))}
                </div>
              );
            })()}
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
        monthly_rent={unit?.monthly_rent || null}
        unit={unit ? {
          due_day: unit.due_day,
          late_fee_type: unit.late_fee_type || '',
          late_fee_amount: unit.late_fee_amount || 0,
          daily_late_fee: unit.daily_late_fee,
          move_in_date: unit.move_in_date
        } : null}
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
