import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Building2, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { startOfDay, differenceInDays } from "date-fns";

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statement: {
    id: string;
    total_due: number;
    base_rent: number;
    late_fee: number;
    additional_fees: number;
    period_month: string;
    status?: string;
  } | null;
  allowSplitPayment?: boolean;
  splitPaymentFee?: number | null;
  monthly_rent?: number | null;
  unit?: {
    due_day: number;
    late_fee_type: string;
    late_fee_amount: number;
    daily_late_fee: number;
    move_in_date?: string | null;
  } | null;
}

// Fee constants (must match edge function)
const CARD_FEE_PERCENT = 3.75;
const ACH_FEE_FLAT = 5;
const SERVICE_CHARGE = 25;
const DEFAULT_SPLIT_PAYMENT_FEE = 30;

interface PastDueStatement {
  id: string;
  total_due: number;
  period_month: string;
}

export function PaymentModal({ 
  open, 
  onOpenChange, 
  statement,
  allowSplitPayment = false,
  splitPaymentFee = null,
  monthly_rent = null,
  unit: unitProp = null
}: PaymentModalProps) {
  const { user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState<"card" | "ach">("card");
  const [loading, setLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [pastDueStatements, setPastDueStatements] = useState<PastDueStatement[]>([]);
  const [pastDueLateFee, setPastDueLateFee] = useState(0);
  const [unit, setUnit] = useState<{ due_day: number; late_fee_type: string; late_fee_amount: number; daily_late_fee: number; split_payment_fee?: number | null; first_month_paid?: boolean; move_in_date?: string | null } | null>(null);
  const { toast } = useToast();

  // Fetch past due statements and unit info when modal opens and split payment is allowed
  useEffect(() => {
    if (open && allowSplitPayment && statement && user) {
      fetchPastDueAndUnit();
    } else {
      setPastDueStatements([]);
      setPastDueLateFee(0);
      setPaymentAmount("");
    }
    
    // Use unit prop if provided, otherwise fetch it
    if (open && unitProp) {
      setUnit(unitProp);
    } else if (open && !allowSplitPayment && statement && user) {
      // Fetch unit info for late fee calculation even if split payment is not allowed
      fetchUnitForLateFee();
    }
  }, [open, allowSplitPayment, statement, user, unitProp]);
  
  const fetchUnitForLateFee = async () => {
    if (!statement || !user) return;
    
    try {
      const { data: unitData } = await supabase
        .from("units")
        .select("due_day, late_fee_type, late_fee_amount, daily_late_fee, move_in_date")
        .eq("tenant_id", user.id)
        .maybeSingle();
      
      if (unitData) {
        setUnit(unitData);
      }
    } catch (error) {
      console.error("Error fetching unit for late fee calculation:", error);
    }
  };

  const fetchPastDueAndUnit = async () => {
    if (!statement || !user) return;

    try {
      // Fetch unit info including first_month_paid and move_in_date
      const { data: unitData } = await supabase
        .from("units")
        .select("due_day, late_fee_type, late_fee_amount, daily_late_fee, split_payment_fee, first_month_paid, move_in_date")
        .eq("tenant_id", user.id)
        .maybeSingle();

      if (unitData) {
        setUnit(unitData);
      }

      // Fetch past due statements
      const { data: unitDataForStatements } = await supabase
        .from("units")
        .select("id, first_month_paid, due_day")
        .eq("tenant_id", user.id)
        .maybeSingle();

      if (unitDataForStatements && unitData) {
        const { data: allUnpaid } = await supabase
          .from("statements")
          .select("id, total_due, period_month")
          .eq("unit_id", unitDataForStatements.id)
          .in("status", ["unpaid", "overdue"])
          .neq("id", statement.id)
          .order("period_month", { ascending: true });

        if (allUnpaid) {
          // Filter out statements that shouldn't be considered past due
          const today = startOfDay(new Date());
          const currentMonth = `${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
          
          const pastDue = allUnpaid.filter((s) => {
            // If first_month_paid is true, exclude current month's statement
            if (unitDataForStatements.first_month_paid && s.period_month === currentMonth) {
              return false;
            }
            
            // Only include statements where the due date has actually passed
            const [month, year] = s.period_month.split("/").map(Number);
            const dueDate = startOfDay(new Date(year, month - 1, unitData.due_day));
            return today > dueDate;
          });

          setPastDueStatements(pastDue);

          // Calculate late fees if past due > 30 days
          if (pastDue.length > 0 && unitData) {
            const oldestStatement = pastDue[0];
            const [oldestMonth, oldestYear] = oldestStatement.period_month.split("/").map(Number);
            const oldestDueDate = startOfDay(new Date(oldestYear, oldestMonth - 1, unitData.due_day));
            const today = startOfDay(new Date());
            const daysLate = Math.floor((today.getTime() - oldestDueDate.getTime()) / (1000 * 60 * 60 * 24));

            if (daysLate > 30) {
              let lateFee = 0;
              const currentRent = Number(statement.base_rent);

              // Apply flat late fee
              if (unitData.late_fee_type === 'flat') {
                lateFee = Number(unitData.late_fee_amount);
              } else if (unitData.late_fee_type === 'percent') {
                lateFee = (currentRent * Number(unitData.late_fee_amount)) / 100;
              }

              // Apply daily late fee starting from day 31
              const dailyLateFee = Number(unitData.daily_late_fee || 0);
              if (dailyLateFee > 0) {
                const daysForDailyFee = Math.max(0, daysLate - 30);
                lateFee += daysForDailyFee * dailyLateFee;
              }

              setPastDueLateFee(lateFee);
            } else {
              setPastDueLateFee(0);
            }
          }

          // Set default payment amount to half of current month
          const minPayment = Number(statement.base_rent) / 2;
          setPaymentAmount(minPayment.toFixed(2));
        }
      }
    } catch (error) {
      console.error("Error fetching past due statements:", error);
    }
  };

  // Calculate correct late fee for current statement (same logic as TenantDashboard)
  const calculateCurrentLateFee = (): number => {
    if (!statement || !unit || statement.status === "paid") {
      return 0;
    }
    
    if (!unit.due_day || !unit.late_fee_type) {
      return 0;
    }
    
    if (!statement.period_month) {
      return 0;
    }
    
    const today = new Date();
    const [month, year] = statement.period_month.split('/');
    
    // Check if this is the move-in month
    const isMoveInMonth = unit.move_in_date && 
      parseInt(year) === new Date(unit.move_in_date).getFullYear() &&
      parseInt(month) === new Date(unit.move_in_date).getMonth() + 1;
    
    // Calculate due date: move-in month uses move-in date + 1 day, otherwise standard due day
    let dueDate: Date;
    if (isMoveInMonth && unit.move_in_date) {
      const moveInDate = startOfDay(new Date(unit.move_in_date));
      const moveInDueDate = new Date(moveInDate);
      moveInDueDate.setDate(moveInDueDate.getDate() + 1); // Add 1 day (24 hours)
      dueDate = moveInDueDate;
    } else {
      dueDate = new Date(parseInt(year), parseInt(month) - 1, unit.due_day);
    }
    
    // Normalize dates to start of day for accurate calculation
    const todayStart = startOfDay(today);
    const dueDateStart = startOfDay(dueDate);
    
    // If today is the move-in date, no late fees should apply
    if (isMoveInMonth && unit.move_in_date) {
      const moveInDateStart = startOfDay(new Date(unit.move_in_date));
      if (todayStart.getTime() === moveInDateStart.getTime()) {
        return 0;
      }
    }
    
    // If not past due date, no late fees
    if (todayStart <= dueDateStart) {
      return 0;
    }
    
    const daysLate = differenceInDays(todayStart, dueDateStart);
    
    // Calculate flat late fee
    let flatFee = 0;
    if (unit.late_fee_type === 'flat' && unit.late_fee_amount) {
      flatFee = Number(unit.late_fee_amount);
    } else if (unit.late_fee_type === 'percent' && unit.late_fee_amount) {
      flatFee = (Number(statement.base_rent) * Number(unit.late_fee_amount)) / 100;
    }
    
    // Daily late fee applies starting from day 2 (daysLate - 1)
    const daysForDailyFee = Math.max(0, daysLate - 1);
    const dailyLateFeeRate = Number(unit.daily_late_fee || 0);
    const dailyFee = daysForDailyFee * dailyLateFeeRate;
    
    return flatFee + dailyFee;
  };

  // Calculate fees dynamically
  const calculateFees = () => {
    if (!statement) return { paymentMethodFee: 0, serviceCharge: SERVICE_CHARGE, splitFee: 0, total: 0, currentMonthAmount: 0, pastDueAmount: 0, lateFeeAmount: 0, isFullPayment: false };

    // Calculate correct late fee (not from stored value)
    const calculatedLateFee = calculateCurrentLateFee();
    
    // Calculate base amount without stale late fees
    const baseAmountWithoutLateFee = Number(statement.base_rent) + (Number(statement.additional_fees) || 0);
    const correctBaseAmount = baseAmountWithoutLateFee + calculatedLateFee;

    let baseAmount = 0;
    let currentMonthAmount = 0;
    let pastDueAmount = 0;
    let lateFeeAmount = 0;

    if (allowSplitPayment) {
      // Split payment: use payment amount + past due + late fees
      currentMonthAmount = Number(paymentAmount) || Number(statement.base_rent) / 2;
      pastDueAmount = pastDueStatements.reduce((sum, s) => sum + Number(s.total_due || 0), 0);
      lateFeeAmount = pastDueLateFee;
      baseAmount = currentMonthAmount + pastDueAmount + lateFeeAmount;
      
      // Calculate full amount (current month's full rent + past due + late fees)
      const fullCurrentMonthAmount = Number(statement.base_rent);
      const fullAmount = fullCurrentMonthAmount + pastDueAmount + lateFeeAmount;
      
      // Round to 2 decimal places for comparison to avoid floating point precision issues
      const roundedCurrentAmount = Math.round(currentMonthAmount * 100) / 100;
      const roundedFullAmount = Math.round(fullCurrentMonthAmount * 100) / 100;
      const roundedBaseAmount = Math.round(baseAmount * 100) / 100;
      const roundedFullTotal = Math.round(fullAmount * 100) / 100;
      
      // Consider it full payment if payment is >= (full amount - $0.01)
      // This allows $1249.99 to be considered full when full amount is $1250.00
      // but $1249.98 will be considered partial
      const isFullPayment = roundedCurrentAmount >= (roundedFullAmount - 0.01) && 
                           roundedBaseAmount >= (roundedFullTotal - 0.01);
      
      // Always include split payment fee when split payment is enabled (charged every month)
      const splitFee = allowSplitPayment ? (splitPaymentFee || unit?.split_payment_fee || DEFAULT_SPLIT_PAYMENT_FEE) : 0;
      
      let paymentMethodFee = 0;
      if (paymentMethod === "card") {
        paymentMethodFee = baseAmount * (CARD_FEE_PERCENT / 100);
      } else {
        paymentMethodFee = ACH_FEE_FLAT;
      }
      
      const total = baseAmount + paymentMethodFee + SERVICE_CHARGE + splitFee;
      
      return {
        paymentMethodFee: Math.round(paymentMethodFee * 100) / 100,
        serviceCharge: SERVICE_CHARGE,
        splitFee,
        total: Math.round(total * 100) / 100,
        currentMonthAmount,
        pastDueAmount,
        lateFeeAmount,
        isFullPayment,
      };
    } else {
      // Standard payment: use calculated base amount (not stored total_due which may have stale late fees)
      baseAmount = correctBaseAmount;
      
      let paymentMethodFee = 0;
      if (paymentMethod === "card") {
        paymentMethodFee = baseAmount * (CARD_FEE_PERCENT / 100);
      } else {
        paymentMethodFee = ACH_FEE_FLAT;
      }
      
      const total = baseAmount + paymentMethodFee + SERVICE_CHARGE;
      
      return {
        paymentMethodFee: Math.round(paymentMethodFee * 100) / 100,
        serviceCharge: SERVICE_CHARGE,
        splitFee: 0,
        total: Math.round(total * 100) / 100,
        currentMonthAmount: baseAmount,
        pastDueAmount: 0,
        lateFeeAmount: calculatedLateFee,
        isFullPayment: true,
      };
    }
  };

  const fees = calculateFees();

  const handlePayment = async () => {
    if (!statement || loading) return; // Prevent multiple clicks

    // Check if there's already a pending payment for this statement
    try {
      const { data: existingPayments } = await supabase
        .from("payments")
        .select("id, status")
        .eq("statement_id", statement.id)
        .in("status", ["pending", "processing"])
        .limit(1);

      if (existingPayments && existingPayments.length > 0) {
        toast({
          title: "Payment Already in Progress",
          description: "You already have a pending payment for this statement. Please wait for it to complete or cancel it first.",
          variant: "destructive",
        });
        return;
      }
    } catch (error) {
      console.error("Error checking existing payments:", error);
      // Continue anyway - better to try than block
    }

    // Validate payment amount for split payments
    if (allowSplitPayment) {
      const minPayment = Number(statement.base_rent) / 2;
      const paymentAmt = Number(paymentAmount);
      const pastDueBalance = pastDueStatements.reduce((sum, s) => sum + Number(s.total_due || 0), 0);
      const lateFeeBalance = pastDueLateFee;
      const maxPayment = Number(statement.base_rent) + pastDueBalance + lateFeeBalance;

      if (paymentAmt < minPayment) {
        toast({
          title: "Invalid Payment Amount",
          description: `Payment amount must be at least $${minPayment.toFixed(2)} (half of current month's rent)`,
          variant: "destructive",
        });
        return;
      }
      if (paymentAmt > maxPayment) {
        toast({
          title: "Invalid Payment Amount",
          description: `Payment amount cannot exceed $${maxPayment.toFixed(2)} (current month + past due)`,
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-rent-payment", {
        body: {
          statement_id: statement.id,
          payment_method: paymentMethod,
          ...(allowSplitPayment && paymentAmount ? { payment_amount: Number(paymentAmount) } : {}),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.url) {
        // Prevent multiple redirects
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Payment error:", error);
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : "Unable to process payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!statement) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay Rent</DialogTitle>
          <DialogDescription>
            Payment for {statement.period_month}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Payment Method Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Select Payment Method</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as "card" | "ach")}
              className="grid grid-cols-2 gap-3"
            >
              <div>
                <RadioGroupItem
                  value="card"
                  id="card"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="card"
                  className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-colors"
                >
                  <CreditCard className="mb-2 h-6 w-6" />
                  <span className="text-sm font-medium">Credit/Debit Card</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    +{CARD_FEE_PERCENT}% fee
                  </span>
                </Label>
              </div>

              <div>
                <RadioGroupItem
                  value="ach"
                  id="ach"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="ach"
                  className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-colors"
                >
                  <Building2 className="mb-2 h-6 w-6" />
                  <span className="text-sm font-medium">Bank Account (ACH)</span>
                  <span className="text-xs text-muted-foreground mt-1">
                    +${ACH_FEE_FLAT} flat fee
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Payment Amount Input for Split Payments */}
          {allowSplitPayment && (
            <div className="space-y-2">
              <Label htmlFor="paymentAmount">Payment Amount *</Label>
              <Input
                id="paymentAmount"
                type="number"
                step="0.01"
                min={Number(statement.base_rent) / 2}
                max={Number(statement.base_rent) + pastDueStatements.reduce((sum, s) => sum + Number(s.total_due || 0), 0) + pastDueLateFee}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder={`Minimum: $${(Number(statement.base_rent) / 2).toFixed(2)}`}
              />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Minimum: ${(Number(statement.base_rent) / 2).toFixed(2)} (half of current month's rent)
                </p>
              </div>
            </div>
          )}

          {/* Fee Breakdown */}
          <Card className="p-4 bg-muted/50">
            <div className="space-y-2">
              {allowSplitPayment ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current Month (Partial)</span>
                    <span>${fees.currentMonthAmount.toFixed(2)}</span>
                  </div>
                  {fees.pastDueAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Past Due Balance</span>
                      <span className="text-destructive">${fees.pastDueAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {fees.lateFeeAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Late Fees (Past Due &gt;30 days)</span>
                      <span className="text-destructive">${fees.lateFeeAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${(fees.currentMonthAmount + fees.pastDueAmount + fees.lateFeeAmount).toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <>
                  {(() => {
                    // Helper function to determine if rent is prorated
                    const isProratedRent = (baseRent: number, monthlyRent: number | null | undefined): boolean => {
                      if (!monthlyRent) return false;
                      // Consider it prorated if base_rent is at least 1% different from monthly_rent
                      // This accounts for rounding differences
                      const difference = Math.abs(baseRent - monthlyRent);
                      return difference > (monthlyRent * 0.01);
                    };
                    
                    const isProrated = isProratedRent(Number(statement.base_rent), monthly_rent);
                    
                    if (isProrated && monthly_rent) {
                      // Show both Base Rent and Prorated Rent when prorated
                      return (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Base Rent</span>
                            <span>${Number(monthly_rent).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Prorated Rent</span>
                            <span>${Number(statement.base_rent).toFixed(2)}</span>
                          </div>
                        </>
                      );
                    } else {
                      // Show only Base Rent when not prorated
                      return (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Base Rent</span>
                          <span>${Number(statement.base_rent).toFixed(2)}</span>
                        </div>
                      );
                    }
                  })()}
                  
                  {fees.lateFeeAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Late Fee</span>
                      <span className="text-destructive">
                        ${fees.lateFeeAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  
                  {Number(statement.additional_fees) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Additional Fees</span>
                      <span>${Number(statement.additional_fees).toFixed(2)}</span>
                    </div>
                  )}

                  <Separator className="my-2" />

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${(Number(statement.base_rent) + (Number(statement.additional_fees) || 0) + fees.lateFeeAmount).toFixed(2)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {paymentMethod === "card" ? `Card Fee (${CARD_FEE_PERCENT}%)` : "ACH Fee"}
                </span>
                <span>${fees.paymentMethodFee.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Service Charge</span>
                <span>${fees.serviceCharge.toFixed(2)}</span>
              </div>

              {allowSplitPayment && fees.splitFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Split Payment Fee</span>
                  <span>${fees.splitFee.toFixed(2)}</span>
                </div>
              )}

              <Separator className="my-2" />

              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span className="text-primary">${fees.total.toFixed(2)}</span>
              </div>
            </div>
          </Card>

          {/* Info notice */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              You will be redirected to our secure payment processor to complete your payment.
            </span>
          </div>

          {/* Pay Button */}
          <Button
            onClick={handlePayment}
            disabled={loading}
            className="w-full h-12 text-base font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Pay $${fees.total.toFixed(2)}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
