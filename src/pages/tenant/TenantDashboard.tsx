import { useState, useEffect } from "react";
import { TenantLayout } from "@/components/tenant/TenantLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Home,
  CreditCard,
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
import { format, differenceInDays, parseISO } from "date-fns";
import { PaymentModal } from "@/components/tenant/PaymentModal";
import { DocumentsModal } from "@/components/tenant/DocumentsModal";
import { MaintenanceModal } from "@/components/tenant/MaintenanceModal";
import { ContactModal } from "@/components/tenant/ContactModal";
import { TenantSettingsModal } from "@/components/tenant/TenantSettingsModal";
import { HelpModal } from "@/components/tenant/HelpModal";

interface UnitData {
  id: string;
  unit_number: string;
  monthly_rent: number;
  due_day: number;
  allow_split_payment: boolean;
  lease_pdf_url: string | null;
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

  useEffect(() => {
    if (user) {
      fetchTenantData();
    }
  }, [user]);

  const fetchTenantData = async () => {
    try {
      // Fetch tenant profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user?.id)
        .single();
      
      if (profileData) {
        setTenantProfile(profileData);
      }

      // Fetch tenant's unit with property info
      const { data: unitData } = await supabase
        .from("units")
        .select(`
          id,
          unit_number,
          monthly_rent,
          due_day,
          allow_split_payment,
          lease_pdf_url,
          property:properties (
            name,
            address
          )
        `)
        .eq("tenant_id", user?.id)
        .maybeSingle();

      if (unitData) {
        setUnit(unitData as unknown as UnitData);

        // Fetch current month's statement (format: MM/yyyy)
        const currentMonth = format(new Date(), "MM/yyyy");
        const { data: statementData } = await supabase
          .from("statements")
          .select("*")
          .eq("unit_id", unitData.id)
          .eq("period_month", currentMonth)
          .maybeSingle();

        if (statementData) {
          setCurrentStatement(statementData);
        } else {
          // If no statement for current month, check for any unpaid/overdue statement
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

        // Fetch recent payments
        const { data: paymentsData } = await supabase
          .from("payments")
          .select("*")
          .eq("unit_id", unitData.id)
          .order("created_at", { ascending: false })
          .limit(5);

        if (paymentsData) {
          setRecentPayments(paymentsData);
          
          // Calculate total paid this year
          const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
          const { data: yearPayments } = await supabase
            .from("payments")
            .select("amount")
            .eq("unit_id", unitData.id)
            .eq("status", "completed")
            .gte("paid_at", yearStart);
          
          if (yearPayments) {
            setTotalPaid(yearPayments.reduce((sum, p) => sum + Number(p.amount), 0));
          }
        }
      }
    } catch (error) {
      console.error("Error fetching tenant data:", error);
    } finally {
      setLoading(false);
    }
  };

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
    const today = new Date();
    const dueDate = new Date(today.getFullYear(), today.getMonth(), unit.due_day);
    return today > dueDate;
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
    { label: "Payment Methods", icon: CreditCard, href: "/tenant/payments" },
    { label: "Documents", icon: FileText, action: () => handleQuickAction("Documents") },
    { label: "Maintenance", icon: Wrench, action: () => handleQuickAction("Maintenance") },
    { label: "Contact", icon: MessageSquare, action: () => handleQuickAction("Contact") },
    { label: "Settings", icon: Settings, action: () => handleQuickAction("Settings") },
    { label: "Help", icon: HelpCircle, action: () => handleQuickAction("Help") },
  ];

  const daysUntilDue = getDaysUntilDue();
  const nextDueDate = getNextDueDate();
  const pastDue = isPastDue();
  const rentDue = currentStatement?.total_due || unit?.monthly_rent || 0;

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
            {/* Status Badge */}
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
                  <div className="flex items-center gap-2 mt-3 text-primary-foreground/80 text-sm">
                    <TrendingUp className="h-4 w-4" />
                    <span>On-time payment streak: 12 months</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 border-0"
                  onClick={() => setPaymentModalOpen(true)}
                  disabled={!currentStatement || currentStatement.status === "paid"}
                >
                  {currentStatement?.status === "paid" ? "Paid" : "Pay Now"}
                  <ExternalLink className="ml-2 h-4 w-4" />
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
                {Number(currentStatement.late_fee) > 0 && (
                  <div>
                    <p className={`text-xs uppercase tracking-wide mb-1 ${pastDue ? 'text-destructive-foreground/60' : 'text-primary-foreground/60'}`}>Late Fee</p>
                    <p className={`text-xl font-semibold ${pastDue ? 'text-destructive-foreground' : 'text-primary-foreground'}`}>
                      ${Number(currentStatement.late_fee).toLocaleString()}
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
            <p className="text-2xl font-bold text-foreground">12 months</p>
            <p className="text-xs text-muted-foreground mt-1">On-time payments</p>
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
              <Button variant="link" className="text-primary p-0 h-auto">
                View All
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
      />

      {/* Documents Modal */}
      <DocumentsModal
        open={documentsModalOpen}
        onOpenChange={setDocumentsModalOpen}
        leaseUrl={unit?.lease_pdf_url}
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
