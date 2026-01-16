import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO } from "date-fns";

interface PaymentData {
  id: string;
  amount: number;
  status: string;
  payment_method: string;
  paid_at: string | null;
  created_at: string;
  unit: {
    unit_number: string;
    property: {
      name: string;
    };
    tenant: {
      full_name: string | null;
      email: string;
    } | null;
  };
}

const ITEMS_PER_PAGE = 10;

export default function AdminPayments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchPayments = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // First get all property IDs for this landlord
      const { data: propertiesData } = await supabase
        .from("properties")
        .select("id")
        .eq("landlord_id", user.id);

      if (!propertiesData || propertiesData.length === 0) {
        setPayments([]);
        setTotalCount(0);
        return;
      }

      const propertyIds = propertiesData.map((p) => p.id);

      // Get all units for these properties
      const { data: unitsData } = await supabase
        .from("units")
        .select("id")
        .in("property_id", propertyIds);

      if (!unitsData || unitsData.length === 0) {
        setPayments([]);
        setTotalCount(0);
        return;
      }

      const unitIds = unitsData.map((u) => u.id);

      // Get count of completed payments only (landlords should only see successful payments)
      const { count } = await supabase
        .from("payments")
        .select("*", { count: "exact", head: true })
        .in("unit_id", unitIds)
        .eq("status", "completed");

      setTotalCount(count || 0);

      // Then fetch the paginated data - only completed payments
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data: paymentsData, error } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          status,
          payment_method,
          paid_at,
          created_at,
          unit_id,
          units(
            unit_number,
            property_id,
            properties(
              id,
              name
            ),
            tenant_id,
            profiles:tenant_id(
              full_name,
              email
            )
          )
        `)
        .in("unit_id", unitIds)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        console.error("Error fetching payments:", error);
        setPayments([]);
        return;
      }

      if (paymentsData) {
        // Transform the data to match our interface
        const transformedPayments = paymentsData
          .filter((p: any) => p.units) // Filter out any payments without unit data
          .map((p: any) => ({
            id: p.id,
            amount: p.amount,
            status: p.status,
            payment_method: p.payment_method,
            paid_at: p.paid_at,
            created_at: p.created_at,
            unit: {
              unit_number: p.units.unit_number,
              property: {
                name: p.units.properties?.name || "Unknown Property",
              },
              tenant: p.units.profiles
                ? {
                    full_name: p.units.profiles.full_name,
                    email: p.units.profiles.email,
                  }
                : null,
            },
          }));
        setPayments(transformedPayments);
      }
    } catch (error) {
      console.error("Error fetching payments:", error);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [user, currentPage]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const getStatusBadge = (status: string) => {
    if (status === "completed" || status === "paid") {
      return (
        <Badge className="bg-primary/10 text-primary border-primary/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Paid
        </Badge>
      );
    } else if (status === "failed") {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    return <CreditCard className="h-4 w-4" />;
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Payments</h1>
          <p className="text-muted-foreground mt-1">
            View all payments across your properties
          </p>
        </div>

        {loading ? (
          <Card className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="text-muted-foreground mt-4">Loading payments...</p>
          </Card>
        ) : payments.length > 0 ? (
          <>
            <Card className="divide-y divide-border">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="p-2 rounded-lg bg-muted">
                      {getPaymentMethodIcon(payment.payment_method)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground">
                          {payment.unit.property.name} - Unit {payment.unit.unit_number}
                        </span>
                        {getStatusBadge(payment.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {payment.unit.tenant
                          ? `${payment.unit.tenant.full_name || payment.unit.tenant.email}`
                          : "No tenant assigned"}
                        {" • "}
                        {payment.payment_method} •{" "}
                        {payment.paid_at
                          ? format(parseISO(payment.paid_at), "MMM d, yyyy")
                          : format(parseISO(payment.created_at), "MMM d, yyyy")}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-foreground">
                      ${Number(payment.amount).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                  {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount} payments
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <Card className="p-8 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No payments yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Payments will appear here once tenants make payments
            </p>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
