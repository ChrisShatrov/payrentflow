import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatsCard } from "@/components/admin/StatsCard";
import { Building2, Home, Users, AlertCircle, Plus, FileText, DollarSign, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

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

  useEffect(() => {
    async function fetchData() {
      if (!user) return;

      try {
        // Fetch user profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.full_name) {
          setUserName(profile.full_name);
        }

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
            accentColor="secondary"
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
