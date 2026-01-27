import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatsCard } from "@/components/admin/StatsCard";
import { Building2, Home, Users, AlertCircle, FileText, DollarSign, Settings, CreditCard, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";

interface DashboardStats {
  properties: number;
  units: number;
  tenants: number;
  unpaidStatements: number;
}

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

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    properties: 0,
    units: 0,
    tenants: 0,
    unpaidStatements: 0,
  });
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = useState<"loading" | "not_connected" | "pending" | "active">("loading");
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [recentPayments, setRecentPayments] = useState<PaymentData[]>([]);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;

      try {
        // Fetch user profile including Stripe account
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, stripe_account_id")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.full_name) {
          setUserName(profile.full_name);
        }
        
        if (profile?.stripe_account_id) {
          setStripeAccountId(profile.stripe_account_id);
        }
        
        // Check Stripe Connect status (function gets account from user's profile)
        checkStripeStatus();

        // Fetch stats - properties and units
        const [propertiesRes, unitsRes] = await Promise.all([
          supabase.from("properties").select("id", { count: "exact" }).eq("landlord_id", user.id),
          supabase.from("units").select("id, tenant_id", { count: "exact" }),
        ]);

        const units = unitsRes.data || [];
        const tenantsCount = units.filter((u) => u.tenant_id).length;

        // Fetch unpaid statements with proper filtering
        // First, get all properties owned by this landlord
        const { data: propertiesData } = await supabase
          .from("properties")
          .select("id")
          .eq("landlord_id", user.id);

        let unpaidStatementsCount = 0;

        if (propertiesData && propertiesData.length > 0) {
          const propertyIds = propertiesData.map((p) => p.id);

          // Get all units for these properties
          const { data: unitsData } = await supabase
            .from("units")
            .select("id, due_day, first_month_paid")
            .in("property_id", propertyIds);

          if (unitsData && unitsData.length > 0) {
            const unitIds = unitsData.map((u) => u.id);

            // Fetch statements for these units with status unpaid or overdue
            const { data: statementsData } = await supabase
              .from("statements")
              .select(`
                id,
                unit_id,
                period_month,
                total_due,
                status
              `)
              .in("unit_id", unitIds)
              .in("status", ["unpaid", "overdue"]);

            // Filter statements using the same logic as Tenants tab
            const currentMonth = format(new Date(), "MM/yyyy");
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (statementsData) {
              // Fetch payments for all these statements to check if they're effectively paid
              const statementIds = statementsData.map((s) => s.id);
              const { data: paymentsData } = await supabase
                .from("payments")
                .select("statement_id, statement_amount")
                .in("statement_id", statementIds)
                .eq("status", "completed");

              // Create a map of statement_id -> total paid
              const paymentsMap = new Map<string, number>();
              if (paymentsData) {
                paymentsData.forEach((p) => {
                  const current = paymentsMap.get(p.statement_id) || 0;
                  paymentsMap.set(p.statement_id, current + (Number(p.statement_amount) || 0));
                });
              }

              // Filter statements
              const filteredStatements = statementsData.filter((statement) => {
                const unit = unitsData.find((u) => u.id === statement.unit_id);
                if (!unit) return false;

                // Check if statement is effectively paid
                const totalPaid = paymentsMap.get(statement.id) || 0;
                const totalDue = Number(statement.total_due) || 0;
                if (totalPaid >= totalDue) {
                  return false; // Effectively paid, exclude
                }

                // If first_month_paid is true, exclude current month's statement
                if (unit.first_month_paid && statement.period_month === currentMonth) {
                  return false;
                }

                // Check if this is a future month's statement that isn't due yet
                const [statementMonth, statementYear] = statement.period_month.split('/').map(Number);
                const [currentMonthNum, currentYear] = currentMonth.split('/').map(Number);

                if (statementYear > currentYear || (statementYear === currentYear && statementMonth > currentMonthNum)) {
                  // Future month - check if it's due yet based on due_day
                  const statementDueDate = new Date(statementYear, statementMonth - 1, unit.due_day);
                  statementDueDate.setHours(0, 0, 0, 0);

                  // Only include if the due date has passed
                  if (today <= statementDueDate) {
                    return false; // Not due yet, exclude it
                  }
                }

                return true;
              });

              unpaidStatementsCount = filteredStatements.length;
            }
          }
        }

        setStats({
          properties: propertiesRes.count || 0,
          units: unitsRes.count || 0,
          tenants: tenantsCount,
          unpaidStatements: unpaidStatementsCount,
        });

        // Fetch recent payments for all properties owned by this landlord
        // Reuse propertiesData from above (already fetched for unpaid statements)
        if (propertiesData && propertiesData.length > 0) {
          const propertyIds = propertiesData.map((p) => p.id);

          // Get all units for these properties
          const { data: unitsData } = await supabase
            .from("units")
            .select("id")
            .in("property_id", propertyIds);

          if (unitsData && unitsData.length > 0) {
            const unitIds = unitsData.map((u) => u.id);

            // Get only completed payments for these units (landlords should only see successful payments)
            const { data: paymentsData } = await supabase
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
              .limit(3);

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
              setRecentPayments(transformedPayments);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user]);

  const checkStripeStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-connect-status");
      
      if (error || data?.error) {
        setStripeStatus("not_connected");
        return;
      }
      
      if (!data?.has_account) {
        setStripeStatus("not_connected");
      } else if (data?.charges_enabled && data?.payouts_enabled) {
        setStripeStatus("active");
      } else {
        setStripeStatus("pending");
      }
    } catch (error) {
      console.error("Error checking Stripe status:", error);
      setStripeStatus("not_connected");
    }
  };

  const handleConnectStripe = async () => {
    setConnectingStripe(true);
    try {
      // Ensure we have a valid session before calling the function
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error("Please sign in first.");
      }

      // The supabase client should automatically include the Authorization header
      const { data, error } = await supabase.functions.invoke("create-connect-account");
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success("Complete the Stripe onboarding in the new tab");
      }
    } catch (error) {
      console.error("Error connecting Stripe:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start Stripe Connect setup");
    } finally {
      setConnectingStripe(false);
    }
  };

  const handleAccessStripeAccount = async () => {
    try {
      // Ensure we have a valid session before calling the function
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error("Please sign in first.");
      }

      // Get Stripe login link (magic link)
      const { data, error } = await supabase.functions.invoke("get-stripe-login-link");
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success("Opening your Stripe account dashboard");
      }
    } catch (error) {
      console.error("Error accessing Stripe account:", error);
      toast.error(error instanceof Error ? error.message : "Failed to access Stripe account");
    }
  };

  const quickActions = [
    { title: "Add Property", icon: Building2, href: "/admin/properties" },
    { title: "Add Unit", icon: Home, href: "/admin/properties" },
    { title: "View Statements", icon: FileText, href: "/admin/statements" },
    { title: "Settings", icon: Settings, href: "/admin" },
  ];

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Properties"
            value={loading ? "—" : stats.properties}
            icon={Building2}
            accentColor="primary"
          />
          <StatsCard
            title="Units"
            value={loading ? "—" : stats.units}
            icon={Home}
            accentColor="blue"
          />
          <StatsCard
            title="Tenants"
            value={loading ? "—" : stats.tenants}
            icon={Users}
            accentColor="accent"
          />
          <StatsCard
            title="Unpaid Statements"
            value={loading ? "—" : stats.unpaidStatements}
            icon={AlertCircle}
            accentColor="warning"
          />
        </div>

        {/* Stripe Connect Status Card */}
        <Card className={`p-6 mb-8 ${stripeStatus === "not_connected" ? "border-destructive/50 bg-destructive/5" : stripeStatus === "pending" ? "border-yellow-500/50 bg-yellow-500/5" : "border-primary/50 bg-primary/5"}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className={`p-3 rounded-xl flex-shrink-0 ${stripeStatus === "active" ? "bg-primary/10" : stripeStatus === "pending" ? "bg-yellow-500/10" : "bg-destructive/10"}`}>
                <CreditCard className={`h-6 w-6 ${stripeStatus === "active" ? "text-primary" : stripeStatus === "pending" ? "text-yellow-600" : "text-destructive"}`} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-foreground">Payment Setup</h3>
                <p className="text-sm text-muted-foreground">
                  {stripeStatus === "loading" && "Checking Stripe Connect status..."}
                  {stripeStatus === "not_connected" && "Connect your Stripe account to receive rent payments"}
                  {stripeStatus === "pending" && "Complete your Stripe onboarding to start receiving payments"}
                  {stripeStatus === "active" && "Your Stripe account is connected and ready to receive payments"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {stripeStatus === "loading" && (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              )}
              {stripeStatus === "active" && (
                <>
                  <Badge className="bg-primary/10 text-primary border-0 whitespace-nowrap">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                  <Button onClick={handleAccessStripeAccount} variant="outline" size="sm" className="whitespace-nowrap">
                    Access Account
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </>
              )}
              {stripeStatus === "pending" && (
                <>
                  <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-0 whitespace-nowrap">
                    Pending
                  </Badge>
                  <Button onClick={handleConnectStripe} disabled={connectingStripe} size="sm" className="whitespace-nowrap">
                    {connectingStripe ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue Setup"}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </>
              )}
              {stripeStatus === "not_connected" && (
                <Button onClick={handleConnectStripe} disabled={connectingStripe} className="whitespace-nowrap">
                  {connectingStripe ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
                  Connect Stripe
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Welcome Banner */}
        <div className="bg-primary rounded-2xl p-8 mb-8 text-primary-foreground">
          <h2 className="text-2xl font-bold mb-2">
            Welcome back{userName ? `, ${userName}` : ""}!
          </h2>
          <p className="text-primary-foreground/80">
            Manage your properties, tenants, and rental statements from this dashboard.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                to={action.href}
                className="bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-3 hover:border-primary/50 hover:shadow-md transition-all group"
              >
                <div className="p-3 rounded-xl bg-muted group-hover:bg-primary/10 transition-colors">
                  <action.icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <span className="text-sm font-medium text-foreground">{action.title}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Recent Payments</h3>
            <Button variant="ghost" size="sm" className="text-primary" asChild>
              <Link to="/admin/payments">
                View All
              </Link>
            </Button>
          </div>
          {recentPayments.length > 0 ? (
            <div className="space-y-3">
              {recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground">
                        {payment.unit.property.name} - Unit {payment.unit.unit_number}
                      </span>
                      <Badge
                        variant={
                          payment.status === "completed" || payment.status === "paid"
                            ? "default"
                            : payment.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {payment.status === "completed" || payment.status === "paid"
                          ? "Paid"
                          : payment.status === "failed"
                          ? "Failed"
                          : "Pending"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {payment.unit.tenant
                        ? `${payment.unit.tenant.full_name || payment.unit.tenant.email}`
                        : "No tenant assigned"}
                      {" • "}
                      {payment.payment_method} • ${Number(payment.amount).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">
                      {payment.paid_at
                        ? new Date(payment.paid_at).toLocaleDateString()
                        : new Date(payment.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No recent payments to display</p>
              <p className="text-sm">Payments will appear here</p>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
