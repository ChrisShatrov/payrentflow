import { useState, useEffect, useCallback } from "react";
import { TenantLayout } from "@/components/tenant/TenantLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CreditCard,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  DollarSign,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface PaymentData {
  id: string;
  amount: number;
  status: string;
  payment_method: string;
  paid_at: string | null;
  created_at: string;
  statement_id: string | null;
}

export default function TenantPayments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [unitId, setUnitId] = useState<string | null>(null);

  const syncPaymentStatus = useCallback(async (paymentId: string, refreshAfter = false) => {
    try {
      console.log("Calling sync-payment-status function with payment_id:", paymentId);
      const { data, error } = await supabase.functions.invoke("sync-payment-status", {
        body: { payment_id: paymentId },
      });

      console.log("Sync function response:", { data, error });

      if (error) {
        console.error("Function invocation error:", error);
        throw error;
      }

      if (data?.error) {
        console.error("Function returned error:", data.error);
        toast.error(data.error || "Failed to sync payment status");
        return false;
      }

      if (data?.success) {
        if (data.newStatus !== data.oldStatus) {
          toast.success(data.message || "Payment status updated");
        } else {
          toast.info(data.message || "Payment status is up to date");
        }
        return true;
      }
      
      console.warn("Unexpected response format:", data);
      return false;
    } catch (error: any) {
      console.error("Error syncing payment status:", error);
      let errorMessage = "Failed to sync payment status";
      
      // Check for specific error types
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else if (error?.error) {
        errorMessage = error.error;
      }
      
      // Check if function doesn't exist (404 or function not found)
      if (errorMessage.includes("not found") || errorMessage.includes("404") || errorMessage.includes("Function")) {
        errorMessage = "Sync function not deployed. Please deploy sync-payment-status function.";
      }
      
      console.error("Full error details:", {
        error,
        message: errorMessage,
        stack: error?.stack,
      });
      
      toast.error(errorMessage);
      return false;
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch tenant's unit
      const { data: unitData, error: unitError } = await supabase
        .from("units")
        .select("id")
        .eq("tenant_id", user?.id)
        .maybeSingle();

      if (unitError) {
        console.error("Error fetching unit:", unitError);
        return;
      }

      if (unitData) {
        setUnitId(unitData.id);

        // Fetch all payments for this unit (no limit - show all, including pending)
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("payments")
          .select("*")
          .eq("unit_id", unitData.id)
          .order("created_at", { ascending: false });

        if (paymentsError) {
          console.error("Error fetching payments:", paymentsError);
          setPayments([]);
        } else {
          console.log("Fetched payments for unit:", unitData.id, paymentsData);
          setPayments(paymentsData || []);
          
          // Auto-sync pending card payments (they should complete immediately)
          // Do this asynchronously to avoid blocking the UI
          if (paymentsData && paymentsData.length > 0) {
            const pendingCardPayments = paymentsData.filter(
              p => p.status === "pending" && p.payment_method === "Card"
            );
            
            // Sync the most recent pending card payment (fire and forget)
            if (pendingCardPayments.length > 0) {
              const mostRecent = pendingCardPayments[0];
              console.log("Auto-syncing pending card payment:", mostRecent.id);
              syncPaymentStatus(mostRecent.id).then((synced) => {
                if (synced) {
                  // Refresh data after successful sync
                  setTimeout(() => {
                    fetchData();
                  }, 1000);
                }
              }).catch(console.error);
            }
          }
        }
      } else {
        console.log("No unit found for tenant:", user?.id);
        setPayments([]);
      }
    } catch (error) {
      console.error("Error fetching payments:", error);
    } finally {
      setLoading(false);
    }
  }, [user, syncPaymentStatus]);

  useEffect(() => {
    if (user) {
      fetchData();
      // Refresh payments every 5 seconds to catch new payments
      const interval = setInterval(() => {
        fetchData();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [user, fetchData]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-primary/10 text-primary border-0">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            {status}
          </Badge>
        );
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    return <CreditCard className="h-4 w-4" />;
  };


  if (loading) {
    return (
      <TenantLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </TenantLayout>
    );
  }

  if (!unitId) {
    return (
      <TenantLayout>
        <div className="text-center py-12">
          <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
          <h1 className="text-3xl font-bold text-foreground">Payments</h1>
          <p className="text-muted-foreground mt-1">
            View all your payment transactions
          </p>
        </div>

        {/* Payments List */}
        <div>
          {payments.length > 0 ? (
            <Card className="divide-y divide-border">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-full ${
                        payment.status === "completed"
                          ? "bg-primary/10 text-primary"
                          : "bg-accent/10 text-accent"
                      }`}
                    >
                      {payment.status === "completed" ? (
                        <ArrowUpRight className="h-5 w-5" />
                      ) : (
                        <Clock className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {payment.status === "completed" ? "Rent Payment" : "Pending Payment"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-muted-foreground">
                          {payment.paid_at
                            ? format(parseISO(payment.paid_at), "MMM d, yyyy 'at' h:mm a")
                            : format(parseISO(payment.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                        {payment.payment_method && (
                          <>
                            <span className="text-muted-foreground">•</span>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              {getPaymentMethodIcon(payment.payment_method)}
                              <span>{payment.payment_method}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p
                        className={`text-lg font-semibold ${
                          payment.status === "completed"
                            ? "text-foreground"
                            : "text-accent"
                        }`}
                      >
                        -${Number(payment.amount).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(payment.status)}
                      {payment.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            const synced = await syncPaymentStatus(payment.id);
                            if (synced) {
                              setTimeout(() => fetchData(), 500);
                            }
                          }}
                          className="h-8 w-8 p-0"
                          title="Sync payment status from Stripe"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No payments yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your payment history will appear here
              </p>
            </Card>
          )}
        </div>
      </div>
    </TenantLayout>
  );
}
