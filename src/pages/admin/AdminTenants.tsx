import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
// import { AddTenantDialog } from "@/components/admin/AddTenantDialog";
import { InviteTenantDialog } from "@/components/admin/InviteTenantDialog";
import { UploadLeaseDialog } from "@/components/admin/UploadLeaseDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Users, Mail, Phone, FileText, Download, Loader2, Eye } from "lucide-react";
import { PdfViewerModal, type PdfViewerSource } from "@/components/shared/PdfViewerModal";
import { format } from "date-fns";

interface StatementBreakdown {
  period_month: string;
  total_due: number;
  base_rent: number;
  late_fee: number;
  additional_fees: number;
  split_fee: number;
}

interface TenantData {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  propertyName: string | null;
  unitNumber: string | null;
  unitId: string | null;
  monthlyRent: number | null;
  status: "active" | "pending" | "inactive";
  totalOwed: number;
  owedBreakdown: StatementBreakdown[];
  leaseUrl: string | null;
}

export default function AdminTenants() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<TenantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaseDialogOpen, setLeaseDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantData | null>(null);
  const [downloadingTenantId, setDownloadingTenantId] = useState<string | null>(null);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfSource, setPdfSource] = useState<PdfViewerSource | null>(null);
  const [pdfTitle, setPdfTitle] = useState("Lease");

  const fetchTenants = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // First, fetch only properties owned by this landlord
      const { data: properties, error: propertiesError } = await supabase
        .from("properties")
        .select("id, name")
        .eq("landlord_id", user.id);

      if (propertiesError) throw propertiesError;

      // If landlord has no properties, return empty array
      if (!properties || properties.length === 0) {
        setTenants([]);
        setLoading(false);
        return;
      }

      const propertyIds = properties.map((p) => p.id);

      // Fetch only units that belong to this landlord's properties
      const { data: units, error: unitsError } = await supabase
        .from("units")
        .select("id, tenant_id, unit_number, monthly_rent, property_id, lease_pdf_url, first_month_paid, due_day")
        .in("property_id", propertyIds);

      if (unitsError) throw unitsError;

      // If no units, return empty array
      if (!units || units.length === 0) {
        setTenants([]);
        setLoading(false);
        return;
      }

      // Get only tenant IDs that are assigned to units in this landlord's properties
      const tenantIds = units
        .map((u) => u.tenant_id)
        .filter((id): id is string => id !== null);

      // If no tenants assigned, return empty array
      if (tenantIds.length === 0) {
        setTenants([]);
        setLoading(false);
        return;
      }

      // Fetch only tenant profiles that are assigned to this landlord's units
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone")
        .eq("role", "tenant")
        .in("id", tenantIds);

      if (profilesError) throw profilesError;

      // Get unit IDs for filtering statements
      const unitIds = units.map((u) => u.id);

      // Fetch unpaid/overdue statements with breakdown for this landlord's units
      const { data: statements, error: statementsError } = await supabase
        .from("statements")
        .select("unit_id, total_due, status, period_month, base_rent, late_fee, additional_fees, split_fee")
        .in("status", ["unpaid", "partial", "overdue"])
        .in("unit_id", unitIds);

      if (statementsError) throw statementsError;

      // Get current month for filtering (format: MM/yyyy)
      const currentMonth = format(new Date(), "MM/yyyy");

      // Map data together
      const tenantsData: TenantData[] = (profiles || []).map((profile) => {
        const unit = (units || []).find((u) => u.tenant_id === profile.id);
        const property = unit ? (properties || []).find((p) => p.id === unit.property_id) : null;
        
        // Calculate total owed from unpaid statements
        // If first_month_paid is true, exclude current month's statement
        // Also exclude future statements that aren't due yet
        const tenantStatements = unit 
          ? (statements || []).filter((s) => {
              if (s.unit_id !== unit.id) return false;
              
              // If first_month_paid is true, exclude current month's statement
              if (unit.first_month_paid && s.period_month === currentMonth) {
                return false;
              }
              
              // Check if this is a future month's statement that isn't due yet
              const [statementMonth, statementYear] = s.period_month.split('/').map(Number);
              const [currentMonthNum, currentYear] = currentMonth.split('/').map(Number);
              
              // If statement is for a future month, check if it's due
              if (statementYear > currentYear || (statementYear === currentYear && statementMonth > currentMonthNum)) {
                // Future month - check if it's due yet based on due_day
                const today = new Date();
                const statementDueDate = new Date(statementYear, statementMonth - 1, unit.due_day);
                
                // Only include if the due date has passed
                if (today <= statementDueDate) {
                  return false; // Not due yet, exclude it
                }
              }
              
              return true;
            })
          : [];
        const totalOwed = tenantStatements.reduce((sum, s) => sum + Number(s.total_due), 0);
        const owedBreakdown: StatementBreakdown[] = tenantStatements.map((s) => ({
          period_month: s.period_month,
          total_due: Number(s.total_due),
          base_rent: Number(s.base_rent ?? 0),
          late_fee: Number(s.late_fee ?? 0),
          additional_fees: Number(s.additional_fees ?? 0),
          split_fee: Number(s.split_fee ?? 0),
        }));

        // Determine status
        let status: "active" | "pending" | "inactive" = "pending";
        if (unit) {
          status = "active";
        }

        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          phone: profile.phone,
          propertyName: property?.name || null,
          unitNumber: unit?.unit_number || null,
          unitId: unit?.id || null,
          monthlyRent: unit?.monthly_rent || null,
          status,
          totalOwed,
          owedBreakdown,
          leaseUrl: unit?.lease_pdf_url || null,
        };
      });

      setTenants(tenantsData);
    } catch (error) {
      console.error("Error fetching tenants:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTenants();
    }
  }, [user]);

  const baseUrl = import.meta.env.VITE_SUPABASE_URL;

  const handleViewLease = async (tenant: TenantData) => {
    if (!tenant.unitId || !tenant.leaseUrl) return;
    setDownloadingTenantId(tenant.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to view documents");
        return;
      }
      const response = await fetch(
        `${baseUrl}/functions/v1/serve-lease-pdf?unitId=${tenant.unitId}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (!response.ok) {
        toast.error("Failed to load lease document");
        return;
      }
      const blob = await response.blob();
      setPdfSource({ type: "blob", blob });
      setPdfTitle(`Lease – ${tenant.full_name || tenant.email}`);
      setPdfViewerOpen(true);
    } catch (error) {
      console.error("Error loading lease:", error);
      toast.error("Failed to load lease document");
    } finally {
      setDownloadingTenantId(null);
    }
  };

  const handleDownloadLease = async (tenant: TenantData) => {
    if (!tenant.unitId || !tenant.leaseUrl) return;
    
    setDownloadingTenantId(tenant.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to download documents");
        return;
      }

      const response = await fetch(
        `${baseUrl}/functions/v1/serve-lease-pdf?unitId=${tenant.unitId}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        toast.error("Failed to download lease document");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lease-${tenant.full_name || tenant.email}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast.success("Lease downloaded successfully");
    } catch (error) {
      console.error("Error downloading lease:", error);
      toast.error("Failed to download lease document");
    } finally {
      setDownloadingTenantId(null);
    }
  };

  const getStatusBadge = (status: TenantData["status"]) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Active</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "inactive":
        return <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Tenants</h1>
            <p className="text-muted-foreground mt-1">Manage your tenants and invitations</p>
          </div>
          <div className="flex gap-3">
            <InviteTenantDialog onTenantInvited={fetchTenants} />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : tenants.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tenants yet</h3>
            <p className="text-muted-foreground mb-6">
              Invite tenants by email or they will appear here once they sign up and are assigned to a unit.
            </p>
            <div className="flex gap-3 justify-center">
              <InviteTenantDialog onTenantInvited={fetchTenants} />
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Tenant</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Monthly Rent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Owed</TableHead>
                  <TableHead className="text-center">Lease</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="font-medium">{tenant.full_name || "—"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{tenant.email}</span>
                        </div>
                        {tenant.phone && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{tenant.phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {tenant.propertyName ? (
                        <span>{tenant.propertyName}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {tenant.unitNumber ? (
                        <span>Unit {tenant.unitNumber}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {tenant.monthlyRent ? (
                        <span className="font-medium">${tenant.monthlyRent.toLocaleString()}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(tenant.status)}</TableCell>
                    <TableCell className="text-right">
                      {tenant.totalOwed > 0 ? (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-medium text-destructive cursor-help underline decoration-dashed decoration-destructive/50 underline-offset-2">
                                ${tenant.totalOwed.toLocaleString()}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-sm p-3 text-left">
                              <div className="font-semibold mb-2">How this total is calculated</div>
                              <div className="space-y-2 text-xs">
                                {tenant.owedBreakdown.map((s) => {
                                  const [mm, yyyy] = s.period_month.split("/");
                                  const periodLabel = format(new Date(Number(yyyy), Number(mm) - 1), "MMM yyyy");
                                  const parts: string[] = [];
                                  if (s.base_rent > 0) parts.push(`Base rent $${s.base_rent.toLocaleString()}`);
                                  if (s.late_fee > 0) parts.push(`Late fee $${s.late_fee.toLocaleString()}`);
                                  if (s.additional_fees > 0) parts.push(`Other $${s.additional_fees.toLocaleString()}`);
                                  if (s.split_fee > 0) parts.push(`Split fee $${s.split_fee.toLocaleString()}`);
                                  return (
                                    <div key={s.period_month} className="border-b border-border/50 pb-1.5 last:border-0 last:pb-0">
                                      <span className="font-medium">{periodLabel}:</span>{" "}
                                      {parts.length ? parts.join(" + ") : "—"} = ${s.total_due.toLocaleString()}
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-2 pt-2 border-t border-border font-medium">
                                Total past due: ${tenant.totalOwed.toLocaleString()}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground">$0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {tenant.unitId ? (
                        <div className="flex items-center justify-center gap-1">
                          {tenant.leaseUrl && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={downloadingTenantId === tenant.id}
                                onClick={() => handleViewLease(tenant)}
                                className="gap-1.5"
                              >
                                {downloadingTenantId === tenant.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={downloadingTenantId === tenant.id}
                                onClick={() => handleDownloadLease(tenant)}
                                className="gap-1.5"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Download
                              </Button>
                            </>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedTenant(tenant);
                              setLeaseDialogOpen(true);
                            }}
                            className="gap-1.5"
                          >
                            {tenant.leaseUrl ? "Replace" : "Upload"}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <PdfViewerModal
          open={pdfViewerOpen}
          onOpenChange={setPdfViewerOpen}
          source={pdfSource}
          title={pdfTitle}
          downloadFilename="lease.pdf"
        />

        {/* Lease Upload Dialog */}
        {selectedTenant && selectedTenant.unitId && (
          <UploadLeaseDialog
            open={leaseDialogOpen}
            onOpenChange={setLeaseDialogOpen}
            unitId={selectedTenant.unitId}
            unitNumber={selectedTenant.unitNumber || ""}
            tenantName={selectedTenant.full_name || "Tenant"}
            currentLeaseUrl={selectedTenant.leaseUrl}
            onLeaseUploaded={fetchTenants}
          />
        )}

      </div>
    </AdminLayout>
  );
}
