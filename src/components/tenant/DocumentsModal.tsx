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
  leaseUrl?: string | null;
  unitId?: string | null;
}

export function DocumentsModal({ open, onOpenChange, leaseUrl, unitId }: DocumentsModalProps) {
  const [loading, setLoading] = useState(false);

  const handleViewLease = async () => {
    if (!leaseUrl || !unitId) return;
    
    setLoading(true);
    try {
      // Get auth session for the edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to view documents");
        return;
      }

      // Call our edge function that proxies the PDF from our domain
      const response = await fetch(
        `https://heismaqehgqxcrndtqmz.supabase.co/functions/v1/serve-lease-pdf?unitId=${unitId}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("Error fetching lease:", error);
        toast.error("Failed to load lease document");
        return;
      }

      // Create blob URL and open
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      console.error("Error viewing lease:", error);
      toast.error("Failed to load lease document");
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
              <div className={`p-2 rounded-lg ${leaseUrl ? "bg-primary/10" : "bg-muted"}`}>
                <File className={`h-5 w-5 ${leaseUrl ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className="font-medium text-foreground">Lease Agreement</p>
                <p className="text-xs text-muted-foreground">
                  {leaseUrl ? "View your signed lease" : "Not yet uploaded"}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={!leaseUrl || loading}
              onClick={handleViewLease}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : leaseUrl ? (
                <>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  View
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
