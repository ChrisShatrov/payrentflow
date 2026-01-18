import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Download, Eye, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CreateLeaseWizard } from "@/components/admin/CreateLeaseWizard";
import { LeasePreviewModal } from "@/components/admin/LeasePreviewModal";
import { LeaseStatusBadge } from "@/components/shared/LeaseStatusBadge";
import { LeaseTimeline } from "@/components/shared/LeaseTimeline";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Lease {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  pdf_draft_url: string | null;
  pdf_signed_url: string | null;
  docusign_envelope_id: string | null;
  units: {
    unit_number: string;
    properties: {
      name: string;
      address: string;
    };
  };
  profiles: {
    full_name: string;
    email: string;
  };
  lease_templates: {
    name: string;
  };
}

export default function AdminLeases() {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [previewLease, setPreviewLease] = useState<Lease | null>(null);
  const [selectedLease, setSelectedLease] = useState<Lease | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [deleteLease, setDeleteLease] = useState<Lease | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchLeases = async () => {
    try {
      let query = supabase
        .from("leases")
        .select(`
          *,
          units!inner(
            unit_number,
            properties!inner(
              name,
              address
            )
          ),
          profiles:tenant_id(
            full_name,
            email
          ),
          lease_templates(
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLeases(data || []);
    } catch (error: any) {
      console.error("Error fetching leases:", error);
      toast.error("Failed to load leases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeases();
  }, [statusFilter]);

  const handleSendForSignature = async (leaseId: string) => {
    try {
      toast.loading("Sending lease for signature...");
      const { data, error } = await supabase.functions.invoke("send-lease-for-signature", {
        body: { lease_id: leaseId },
      });

      toast.dismiss();
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Lease sent for signature");
      fetchLeases();
    } catch (error: any) {
      toast.error(error.message || "Failed to send lease for signature");
    }
  };

  const handleDownload = async (lease: Lease, type: "draft" | "signed") => {
    try {
      const url = type === "draft" ? lease.pdf_draft_url : lease.pdf_signed_url;
      if (!url) {
        toast.error(`${type === "draft" ? "Draft" : "Signed"} PDF not available`);
        return;
      }

      // If it's a signed URL, use it directly
      if (url.startsWith("http")) {
        window.open(url, "_blank");
      } else {
        // Otherwise, get a signed URL from storage
        const { data } = await supabase.storage
          .from("leases")
          .createSignedUrl(url, 3600);
        if (data?.signedUrl) {
          window.open(data.signedUrl, "_blank");
        }
      }
    } catch (error: any) {
      toast.error("Failed to download PDF");
    }
  };

  const handleDeleteClick = (lease: Lease) => {
    setDeleteLease(lease);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteLease) return;

    setDeleting(true);
    try {
      // Delete associated PDFs from storage if they exist
      const filesToDelete: string[] = [];
      if (deleteLease.pdf_draft_url && !deleteLease.pdf_draft_url.startsWith("http")) {
        filesToDelete.push(deleteLease.pdf_draft_url);
      }
      if (deleteLease.pdf_signed_url && !deleteLease.pdf_signed_url.startsWith("http")) {
        filesToDelete.push(deleteLease.pdf_signed_url);
      }

      // Delete files from storage (non-blocking - continue even if this fails)
      if (filesToDelete.length > 0) {
        try {
          const { error: storageError } = await supabase.storage.from("leases").remove(filesToDelete);
          if (storageError) {
            console.warn("Error deleting PDFs from storage:", storageError);
            // Continue with lease deletion even if storage deletion fails
          }
        } catch (storageErr) {
          console.warn("Error deleting PDFs from storage:", storageErr);
          // Continue with lease deletion
        }
      }

      // Delete the lease record (this will cascade delete lease_events due to foreign key)
      const { data, error } = await supabase
        .from("leases")
        .delete()
        .eq("id", deleteLease.id)
        .select();

      if (error) {
        console.error("Delete error details:", error);
        throw new Error(error.message || `Failed to delete lease: ${JSON.stringify(error)}`);
      }

      // Check if anything was actually deleted
      if (!data || data.length === 0) {
        throw new Error("Lease not found or you don't have permission to delete it. Please check RLS policies.");
      }

      toast.success("Lease deleted successfully");
      setDeleteDialogOpen(false);
      setDeleteLease(null);
      fetchLeases();
    } catch (error: any) {
      console.error("Error deleting lease:", error);
      toast.error(error.message || "Failed to delete lease. Check console for details.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Leases</h1>
            <p className="text-muted-foreground mt-1">Manage lease agreements</p>
          </div>
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="signed">Signed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="voided">Voided</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Lease
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : leases.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No leases yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first lease agreement to get started.
            </p>
            <Button onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Lease
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {leases.map((lease) => (
              <div
                key={lease.id}
                className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">
                        {lease.lease_templates.name}
                      </h3>
                      <LeaseStatusBadge status={lease.status} />
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      <strong>Property:</strong> {lease.units.properties.name} - Unit {lease.units.unit_number}
                    </p>
                    <p className="text-sm text-muted-foreground mb-1">
                      <strong>Tenant:</strong> {lease.profiles.full_name} ({lease.profiles.email})
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Created {new Date(lease.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedLease(lease);
                        setTimelineOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Timeline
                    </Button>
                    {lease.pdf_draft_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(lease, "draft")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Draft PDF
                      </Button>
                    )}
                    {lease.pdf_signed_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(lease, "signed")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Signed PDF
                      </Button>
                    )}
                    {lease.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => handleSendForSignature(lease.id)}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Send for Signature
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick(lease)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <CreateLeaseWizard
              onComplete={() => {
                setWizardOpen(false);
                fetchLeases();
              }}
              onCancel={() => setWizardOpen(false)}
            />
          </DialogContent>
        </Dialog>

        {selectedLease && (
          <Dialog 
            open={timelineOpen} 
            onOpenChange={(open) => {
              setTimelineOpen(open);
              if (!open) {
                // Clear selected lease when dialog closes
                setTimeout(() => setSelectedLease(null), 200);
              }
            }}
          >
            <DialogContent className="max-w-2xl">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Lease Timeline</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedLease.lease_templates.name} - {selectedLease.profiles.full_name}
                </p>
              </div>
              <LeaseTimeline leaseId={selectedLease.id} />
            </DialogContent>
          </Dialog>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the lease
                {deleteLease && (
                  <>
                    {" "}for <strong>{deleteLease.lease_templates.name}</strong> with tenant{" "}
                    <strong>{deleteLease.profiles.full_name}</strong>.
                  </>
                )}
                {deleteLease?.status !== "draft" && (
                  <span className="block mt-2 text-amber-600 dark:text-amber-400">
                    Note: This lease has been sent for signature. Deleting it may affect the signing process.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Deleting..." : "Delete Lease"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
