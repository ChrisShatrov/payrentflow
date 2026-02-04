import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, File, Download, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DocumentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Signed lease ID (leases table) – preferred for lease-based PDF */
  signedLeaseId?: string | null;
  /** Legacy: unit-scoped lease PDF URL/path on units table */
  leaseUrl?: string | null;
  unitId?: string | null;
}

export function DocumentsModal({ open, onOpenChange, signedLeaseId, leaseUrl, unitId }: DocumentsModalProps) {
  const [loading, setLoading] = useState(false);

  const canDownloadLease = Boolean(signedLeaseId || (leaseUrl && unitId));

  const handleDownloadLease = async () => {
    if (!canDownloadLease) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to download documents");
        return;
      }

      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const params = signedLeaseId
        ? new URLSearchParams({ leaseId: signedLeaseId, type: "signed" })
        : new URLSearchParams({ unitId: unitId! });
      const response = await fetch(
        `${baseUrl}/functions/v1/serve-lease-pdf?${params}`,
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
      a.download = signedLeaseId ? `lease-signed.pdf` : `lease-${unitId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast.success("Lease downloaded successfully");
    } catch (error) {
      console.error("Error downloading lease:", error);
      toast.error("Failed to download lease document");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Documents</DialogTitle>
          <DialogDescription>
            Access your lease agreement and payment statements
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Lease Agreement */}
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${canDownloadLease ? "bg-primary/10" : "bg-muted"}`}>
                <File className={`h-5 w-5 ${canDownloadLease ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="font-medium text-foreground">Lease Agreement</p>
                <p className="text-xs text-muted-foreground">
                  {canDownloadLease ? "Download your signed lease" : "Not yet available"}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={!canDownloadLease || loading}
              onClick={handleDownloadLease}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : canDownloadLease ? (
                <>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download
                </>
              ) : (
                "Pending"
              )}
            </Button>
          </div>

          {/* Statements Link */}
          <Link to="/tenant/statements" onClick={() => onOpenChange(false)}>
            <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Statements</p>
                  <p className="text-xs text-muted-foreground">View your payment statements</p>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
