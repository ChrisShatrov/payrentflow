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

interface DashboardStats {
  properties: number;
  units: number;
  tenants: number;
  unpaidStatements: number;
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

        // Fetch stats
        const [propertiesRes, unitsRes, statementsRes] = await Promise.all([
          supabase.from("properties").select("id", { count: "exact" }),
          supabase.from("units").select("id, tenant_id", { count: "exact" }),
          supabase.from("statements").select("id", { count: "exact" }).eq("status", "unpaid"),
        ]);

        const units = unitsRes.data || [];
        const tenantsCount = units.filter((u) => u.tenant_id).length;

        setStats({
          properties: propertiesRes.count || 0,
          units: unitsRes.count || 0,
          tenants: tenantsCount,
          unpaidStatements: statementsRes.count || 0,
        });
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
      const { data, error } = await supabase.functions.invoke("create-connect-account");
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success("Complete the Stripe onboarding in the new tab");
      }
    } catch (error) {
      console.error("Error connecting Stripe:", error);
      toast.error("Failed to start Stripe Connect setup");
    } finally {
      setConnectingStripe(false);
    }
  };

  const quickActions = [
    { title: "Add Property", icon: Building2, href: "/admin/properties" },
    { title: "Add Tenant", icon: Users, href: "/admin/tenants" },
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stripeStatus === "active" ? "bg-primary/10" : stripeStatus === "pending" ? "bg-yellow-500/10" : "bg-destructive/10"}`}>
                <CreditCard className={`h-6 w-6 ${stripeStatus === "active" ? "text-primary" : stripeStatus === "pending" ? "text-yellow-600" : "text-destructive"}`} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Payment Setup</h3>
                <p className="text-sm text-muted-foreground">
                  {stripeStatus === "loading" && "Checking Stripe Connect status..."}
                  {stripeStatus === "not_connected" && "Connect your Stripe account to receive rent payments"}
                  {stripeStatus === "pending" && "Complete your Stripe onboarding to start receiving payments"}
                  {stripeStatus === "active" && "Your Stripe account is connected and ready to receive payments"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {stripeStatus === "loading" && (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              )}
              {stripeStatus === "active" && (
                <Badge className="bg-primary/10 text-primary border-0">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              )}
              {stripeStatus === "pending" && (
                <>
                  <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-0">
                    Pending
                  </Badge>
                  <Button onClick={handleConnectStripe} disabled={connectingStripe} size="sm">
                    {connectingStripe ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue Setup"}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </>
              )}
              {stripeStatus === "not_connected" && (
                <Button onClick={handleConnectStripe} disabled={connectingStripe}>
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

        {/* Recent Activity Placeholder */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
            <Button variant="ghost" size="sm" className="text-primary">
              View All
            </Button>
          </div>
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No recent activity to display</p>
            <p className="text-sm">Payments and updates will appear here</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
