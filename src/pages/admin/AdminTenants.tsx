import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AddTenantDialog } from "@/components/admin/AddTenantDialog";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Users, Mail, Phone, FileText, X, Download, Loader2 } from "lucide-react";

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
  leaseUrl: string | null;
}

export default function AdminTenants() {
  const [tenants, setTenants] = useState<TenantData[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaseDialogOpen, setLeaseDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantData | null>(null);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [viewingTenant, setViewingTenant] = useState<TenantData | null>(null);

  const fetchTenants = async () => {
    try {
      // Fetch all tenant profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone")
        .eq("role", "tenant");

      if (profilesError) throw profilesError;

      // Fetch units with property info
      const { data: units, error: unitsError } = await supabase
        .from("units")
        .select("id, tenant_id, unit_number, monthly_rent, property_id, lease_pdf_url");

      if (unitsError) throw unitsError;

      // Fetch properties
      const { data: properties, error: propertiesError } = await supabase
        .from("properties")
        .select("id, name");

      if (propertiesError) throw propertiesError;

      // Fetch unpaid/overdue statements
      const { data: statements, error: statementsError } = await supabase
        .from("statements")
        .select("unit_id, total_due, status")
        .in("status", ["unpaid", "partial", "overdue"]);

      if (statementsError) throw statementsError;

      // Map data together
      const tenantsData: TenantData[] = (profiles || []).map((profile) => {
        const unit = (units || []).find((u) => u.tenant_id === profile.id);
        const property = unit ? (properties || []).find((p) => p.id === unit.property_id) : null;
        
        // Calculate total owed from unpaid statements
        const tenantStatements = unit 
          ? (statements || []).filter((s) => s.unit_id === unit.id)
          : [];
        const totalOwed = tenantStatements.reduce((sum, s) => sum + Number(s.total_due), 0);

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
    fetchTenants();
  }, []);

  const handleViewLease = async (tenant: TenantData) => {
    if (!tenant.unitId || !tenant.leaseUrl) return;
    
    setPdfLoading(true);
    setViewingTenant(tenant);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to view documents");
        return;
      }

      const response = await fetch(
        `https://heismaqehgqxcrndtqmz.supabase.co/functions/v1/serve-lease-pdf?unitId=${tenant.unitId}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        toast.error("Failed to load lease document");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      setPdfViewerOpen(true);
    } catch (error) {
      console.error("Error viewing lease:", error);
      toast.error("Failed to load lease document");
    } finally {
      setPdfLoading(false);
    }
  };

  const closePdfViewer = () => {
    setPdfViewerOpen(false);
    setViewingTenant(null);
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
  };

  const handleDownloadLease = () => {
    if (!pdfBlobUrl || !viewingTenant) return;
    const a = document.createElement("a");
    a.href = pdfBlobUrl;
    a.download = `lease-${viewingTenant.full_name || viewingTenant.email}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Lease downloaded");
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
            <AddTenantDialog onTenantAdded={fetchTenants} />
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
              Get started by adding or inviting your first tenant.
            </p>
            <div className="flex gap-3 justify-center">
              <AddTenantDialog onTenantAdded={fetchTenants} />
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
                        <span className="font-medium text-destructive">
                          ${tenant.totalOwed.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">$0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {tenant.unitId ? (
                        <div className="flex items-center justify-center gap-1">
                          {tenant.leaseUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={pdfLoading && viewingTenant?.id === tenant.id}
                              onClick={() => handleViewLease(tenant)}
                              className="gap-1.5"
                            >
                              {pdfLoading && viewingTenant?.id === tenant.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FileText className="h-3.5 w-3.5" />
                              )}
                              View
                            </Button>
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

        {/* PDF Viewer Dialog */}
        <Dialog open={pdfViewerOpen} onOpenChange={closePdfViewer}>
          <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 overflow-hidden">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="font-semibold">
                  Lease Agreement - {viewingTenant?.full_name || viewingTenant?.email}
                </h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadLease}>
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button variant="ghost" size="icon" onClick={closePdfViewer}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 bg-muted">
                {pdfBlobUrl && (
                  <iframe
                    src={pdfBlobUrl}
                    className="w-full h-full border-0"
                    title="Lease Agreement PDF"
                  />
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
