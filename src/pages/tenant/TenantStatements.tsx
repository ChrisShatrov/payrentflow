import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/tenant/TenantLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Download, 
  Calendar, 
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO, differenceInDays } from "date-fns";
import { PaymentModal } from "@/components/tenant/PaymentModal";
import { toast } from "sonner";

interface UnitData {
  id: string;
  unit_number: string;
  monthly_rent: number;
  due_day: number;
  allow_split_payment: boolean;
  late_fee_type: string;
  late_fee_amount: number;
  daily_late_fee: number;
  first_month_paid?: boolean;
  move_in_date?: string | null;
  property: {
    name: string;
  } | null;
}

interface StatementData {
  id: string;
  unit_id: string;
  period_month: string;
  base_rent: number;
  additional_fees: number | null;
  late_fee: number | null;
  split_fee: number | null;
  total_due: number;
  status: string;
  pdf_url: string | null;
  created_at: string;
}

export default function TenantStatements() {
  const { user } = useAuth();
  const [unit, setUnit] = useState<UnitData | null>(null);
  const [statements, setStatements] = useState<StatementData[]>([]);
  const [currentStatement, setCurrentStatement] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [generatingStatement, setGeneratingStatement] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Helper function to determine if rent is prorated
  const isProratedRent = (baseRent: number, monthlyRent: number | null | undefined): boolean => {
    if (!monthlyRent) return false;
    // Consider it prorated if base_rent is at least 1% different from monthly_rent
    // This accounts for rounding differences
    const difference = Math.abs(baseRent - monthlyRent);
    return difference > (monthlyRent * 0.01);
  };

  const fetchData = async () => {
    try {
      // Fetch tenant's unit
      const { data: unitData } = await supabase
        .from("units")
        .select(`
          id,
          unit_number,
          monthly_rent,
          due_day,
          allow_split_payment,
          split_payment_fee,
          late_fee_type,
          late_fee_amount,
          daily_late_fee,
          first_month_paid,
          move_in_date,
          property:properties (name)
        `)
        .eq("tenant_id", user?.id)
        .maybeSingle();

      if (unitData) {
        setUnit(unitData as unknown as UnitData);

        // Fetch all statements for this unit
        const { data: statementsData } = await supabase
          .from("statements")
          .select("*")
          .eq("unit_id", unitData.id)
          .order("period_month", { ascending: false });

        if (statementsData) {
          // Filter statements based on first_month_paid
          const currentMonth = format(new Date(), "MM/yyyy");
          let filteredStatements = statementsData;
          
          // If first_month_paid is true, exclude current month from the list
          if (unitData.first_month_paid) {
            filteredStatements = statementsData.filter(s => s.period_month !== currentMonth);
          }
          
          setStatements(filteredStatements);
          
          // Find current statement - skip current month if first_month_paid is true
          if (unitData.first_month_paid) {
            // Look for next month's statement instead
            const today = new Date();
            const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            const nextMonthStr = format(nextMonth, "MM/yyyy");
            const nextMonthStatement = statementsData.find(s => s.period_month === nextMonthStr);
            setCurrentStatement(nextMonthStatement || null);
          } else {
            // Normal flow - find current month's statement
            const current = statementsData.find(s => s.period_month === currentMonth);
            setCurrentStatement(current || null);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load statements");
    } finally {
      setLoading(false);
    }
  };

  const generateCurrentStatement = async () => {
    if (!unit) return;
    
    setGeneratingStatement(true);
    try {
      const currentMonth = format(new Date(), "MM/yyyy");
      
      const { data, error } = await supabase.functions.invoke("generate-statement", {
        body: { unit_id: unit.id, period_month: currentMonth }
      });

      if (error) throw error;
      
      toast.success("Statement generated successfully");
      fetchData(); // Refresh data
    } catch (error) {
      console.error("Error generating statement:", error);
      toast.error("Failed to generate statement");
    } finally {
      setGeneratingStatement(false);
    }
  };

  const calculateCurrentLateFee = (statement: StatementData) => {
    if (!unit || statement.status === "paid") return 0;
    
    const [month, year] = statement.period_month.split("/").map(Number);
    const statementMonthStart = new Date(year, month - 1, 1);
    const statementMonthEnd = new Date(year, month, 0);
    
    // Check if this is the move-in month
    let dueDate: Date;
    if (unit.move_in_date) {
      const moveInDate = new Date(unit.move_in_date);
      moveInDate.setHours(0, 0, 0, 0);
      
      // Check if move-in is in this statement month
      if (moveInDate >= statementMonthStart && moveInDate <= statementMonthEnd) {
        // For move-in month, due date is move-in date + 1 day
        dueDate = new Date(moveInDate);
        dueDate.setDate(dueDate.getDate() + 1);
        dueDate.setHours(0, 0, 0, 0);
      } else {
        // Standard due date
        dueDate = new Date(year, month - 1, unit.due_day);
        dueDate.setHours(0, 0, 0, 0);
      }
    } else {
      // Standard due date
      dueDate = new Date(year, month - 1, unit.due_day);
      dueDate.setHours(0, 0, 0, 0);
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Never calculate late fees if today <= dueDate
    if (today <= dueDate) return 0;
    
    const daysLate = differenceInDays(today, dueDate);
    
    // One-time late fee
    let oneTimeFee = 0;
    if (unit.late_fee_type === "flat") {
      oneTimeFee = unit.late_fee_amount;
    } else if (unit.late_fee_type === "percent") {
      oneTimeFee = (Number(statement.base_rent) * unit.late_fee_amount) / 100;
    }
    
    // Daily late fee (only applies starting from day 2)
    // Daily fee only applies for days after the first day (so daysLate - 1)
    const daysForDailyFee = Math.max(0, daysLate - 1);
    const dailyFee = daysForDailyFee * unit.daily_late_fee;
    
    return oneTimeFee + dailyFee;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-primary/10 text-primary border-0"><CheckCircle2 className="h-3 w-3 mr-1" />Paid</Badge>;
      case "overdue":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Overdue</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Unpaid</Badge>;
    }
  };

  const formatPeriodMonth = (periodMonth: string) => {
    const [month, year] = periodMonth.split("/");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return format(date, "MMMM yyyy");
  };

  const pastStatements = statements.filter(s => s.id !== currentStatement?.id);

  if (loading) {
    return (
      <TenantLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </TenantLayout>
    );
  }

  if (!unit) {
    return (
      <TenantLayout>
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">No Unit Assigned</h2>
          <p className="text-muted-foreground">You are not currently assigned to any unit.</p>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Statements</h1>
          <p className="text-muted-foreground mt-1">
            View and pay your rent statements for {unit.property?.name || "your unit"}
          </p>
        </div>

        {/* Current Month Statement */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Current Statement
          </h2>
          
          {currentStatement ? (
            <Card className="relative overflow-hidden">
              <div className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-foreground">
                        {formatPeriodMonth(currentStatement.period_month)}
                      </h3>
                      {getStatusBadge(currentStatement.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                      {(() => {
                        const isProrated = isProratedRent(Number(currentStatement.base_rent), unit?.monthly_rent);
                        if (isProrated && unit?.monthly_rent) {
                          // Show both Base Rent and Prorated Rent when prorated
                          return (
                            <>
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide">Base Rent</p>
                                <p className="text-lg font-semibold text-foreground">
                                  ${Number(unit.monthly_rent).toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide">Prorated Rent</p>
                                <p className="text-lg font-semibold text-foreground">
                                  ${Number(currentStatement.base_rent).toLocaleString()}
                                </p>
                              </div>
                            </>
                          );
                        } else {
                          // Show only Base Rent when not prorated
                          return (
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">Base Rent</p>
                              <p className="text-lg font-semibold text-foreground">
                                ${Number(currentStatement.base_rent).toLocaleString()}
                              </p>
                            </div>
                          );
                        }
                      })()}
                      {Number(currentStatement.additional_fees) > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Additional Fees</p>
                          <p className="text-lg font-semibold text-foreground">
                            ${Number(currentStatement.additional_fees).toLocaleString()}
                          </p>
                        </div>
                      )}
                      {(() => {
                        // Always use calculated late fee (which accounts for move-in month and current date)
                        // Never use stored value - it may be stale (e.g., from before move-in date fix)
                        // Only display late fee if it's actually calculated/applied (> 0)
                        const calculatedLateFee = calculateCurrentLateFee(currentStatement);
                        
                        if (calculatedLateFee > 0) {
                          return (
                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">Late Fee</p>
                              <p className="text-lg font-semibold text-destructive">
                                ${calculatedLateFee.toLocaleString()}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Due</p>
                        <p className="text-2xl font-bold text-foreground">
                          {(() => {
                            // Always use calculated late fee for total (never stored value)
                            const calculatedLateFee = calculateCurrentLateFee(currentStatement);
                            const baseTotal = Number(currentStatement.base_rent) + (Number(currentStatement.additional_fees) || 0);
                            const correctTotal = baseTotal + calculatedLateFee;
                            return `$${correctTotal.toLocaleString()}`;
                          })()}
                        </p>
                      </div>
                    </div>

                    {currentStatement.status !== "paid" && (
                      <p className="text-sm text-muted-foreground mt-4">
                        <Clock className="h-4 w-4 inline mr-1" />
                        Due by the {unit.due_day}{unit.due_day === 1 ? "st" : unit.due_day === 2 ? "nd" : unit.due_day === 3 ? "rd" : "th"} of each month
                        {unit.daily_late_fee > 0 && (
                          <span className="text-destructive"> • ${unit.daily_late_fee}/day late fee after due date</span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    {currentStatement.pdf_url && (
                      <Button variant="outline" asChild>
                        <a href={currentStatement.pdf_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </a>
                      </Button>
                    )}
                    {currentStatement.status !== "paid" && (() => {
                      // Check if payment is allowed (within 3 days of due date or past due)
                      const [month, year] = currentStatement.period_month.split("/").map(Number);
                      const statementMonthStart = new Date(year, month - 1, 1);
                      const statementMonthEnd = new Date(year, month, 0);
                      
                      // Calculate due date (accounting for move-in month)
                      let dueDate: Date;
                      if (unit.move_in_date) {
                        const moveInDate = new Date(unit.move_in_date);
                        moveInDate.setHours(0, 0, 0, 0);
                        
                        // Check if move-in is in this statement month
                        if (moveInDate >= statementMonthStart && moveInDate <= statementMonthEnd) {
                          // For move-in month, due date is move-in date + 1 day
                          dueDate = new Date(moveInDate);
                          dueDate.setDate(dueDate.getDate() + 1);
                          dueDate.setHours(0, 0, 0, 0);
                        } else {
                          // Standard due date
                          dueDate = new Date(year, month - 1, unit.due_day);
                          dueDate.setHours(0, 0, 0, 0);
                        }
                      } else {
                        // Standard due date
                        dueDate = new Date(year, month - 1, unit.due_day);
                        dueDate.setHours(0, 0, 0, 0);
                      }
                      
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const daysUntilDue = differenceInDays(dueDate, today);
                      const canPay = daysUntilDue <= 3 || today > dueDate;
                      
                      if (!canPay) {
                        return (
                          <Button disabled title={`Payment available ${daysUntilDue - 3} days before due date`}>
                            Pay Now (Available in {daysUntilDue - 3} days)
                            <ExternalLink className="ml-2 h-4 w-4" />
                          </Button>
                        );
                      }
                      
                      return (
                        <Button onClick={() => setPaymentModalOpen(true)}>
                          Pay Now
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </Button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Statement for This Month</h3>
              <p className="text-muted-foreground mb-4">
                A statement will be generated on the 1st of the month.
              </p>
              <Button onClick={generateCurrentStatement} disabled={generatingStatement}>
                {generatingStatement ? "Generating..." : "Generate Statement Now"}
              </Button>
            </Card>
          )}
        </div>

        {/* Past Statements */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Previous Statements
          </h2>
          
          {pastStatements.length > 0 ? (
            <Card className="divide-y divide-border">
              {pastStatements.map((statement) => (
                <div key={statement.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-muted">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {formatPeriodMonth(statement.period_month)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ${Number(statement.total_due).toLocaleString()} • Due {(() => {
                          const [month, year] = statement.period_month.split("/").map(Number);
                          const dueDate = new Date(year, month - 1, unit.due_day);
                          return format(dueDate, "MMM d, yyyy");
                        })()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {getStatusBadge(statement.status)}
                    {statement.pdf_url ? (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={statement.pdf_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" disabled>
                        <Download className="h-4 w-4 opacity-50" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No previous statements found.</p>
            </Card>
          )}
        </div>

        {/* Late Fee Information */}
        <Card className="p-6 bg-muted/30">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-accent/10">
              <DollarSign className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">Late Fee Policy</h3>
              <p className="text-sm text-muted-foreground">
                Rent is due on the {unit.due_day}{unit.due_day === 1 ? "st" : unit.due_day === 2 ? "nd" : unit.due_day === 3 ? "rd" : "th"} of each month.
                {unit.late_fee_type === "flat" 
                  ? ` A ${unit.late_fee_amount > 0 ? `$${unit.late_fee_amount} one-time late fee` : ""}` 
                  : ` A ${unit.late_fee_amount}% one-time late fee`}
                {unit.daily_late_fee > 0 && ` plus $${unit.daily_late_fee}/day`} will be applied after the due date.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        statement={currentStatement}
        allowSplitPayment={unit?.allow_split_payment || false}
        splitPaymentFee={unit?.split_payment_fee || null}
        monthly_rent={unit?.monthly_rent || null}
      />
    </TenantLayout>
  );
}
