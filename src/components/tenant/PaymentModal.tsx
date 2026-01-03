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
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Building2, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  } | null;
  allowSplitPayment?: boolean;
}

// Fee constants (must match edge function)
const CARD_FEE_PERCENT = 3.5;
const ACH_FEE_FLAT = 3;
const SPLIT_PAYMENT_FEE = 30;

export function PaymentModal({ 
  open, 
  onOpenChange, 
  statement,
  allowSplitPayment = false 
}: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<"card" | "ach">("card");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Calculate fees dynamically
  const calculateFees = () => {
    if (!statement) return { processingFee: 0, splitFee: 0, total: 0 };

    const baseAmount = Number(statement.total_due);
    let processingFee = 0;

    if (paymentMethod === "card") {
      processingFee = baseAmount * (CARD_FEE_PERCENT / 100);
    } else {
      processingFee = ACH_FEE_FLAT;
    }

    const splitFee = allowSplitPayment ? SPLIT_PAYMENT_FEE : 0;
    const total = baseAmount + processingFee + splitFee;

    return {
      processingFee: Math.round(processingFee * 100) / 100,
      splitFee,
      total: Math.round(total * 100) / 100,
    };
  };

  const fees = calculateFees();

  const handlePayment = async () => {
    if (!statement) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-rent-payment", {
        body: {
          statement_id: statement.id,
          payment_method: paymentMethod,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.url) {
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

          {/* Fee Breakdown */}
          <Card className="p-4 bg-muted/50">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base Rent</span>
                <span>${Number(statement.base_rent).toFixed(2)}</span>
              </div>
              
              {Number(statement.late_fee) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Late Fee</span>
                  <span className="text-destructive">
                    ${Number(statement.late_fee).toFixed(2)}
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

              <div className="flex justify-between text-sm font-medium">
                <span>Amount Due</span>
                <span>${Number(statement.total_due).toFixed(2)}</span>
              </div>

              <Separator className="my-2" />

              <div className="text-xs text-muted-foreground mb-2">Payment Processing Fees</div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {paymentMethod === "card" ? `Card Fee (${CARD_FEE_PERCENT}%)` : "ACH Fee"}
                </span>
                <span>${fees.processingFee.toFixed(2)}</span>
              </div>

              {allowSplitPayment && fees.splitFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Split Payment Fee</span>
                  <span>${fees.splitFee.toFixed(2)}</span>
                </div>
              )}

              <Separator className="my-2" />

              <div className="flex justify-between font-semibold text-lg">
                <span>Total to Pay</span>
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
