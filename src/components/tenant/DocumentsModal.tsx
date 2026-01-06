import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, File, Download, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface DocumentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaseUrl?: string | null;
}

export function DocumentsModal({ open, onOpenChange, leaseUrl }: DocumentsModalProps) {
  const [loading, setLoading] = useState(false);

  const handleViewLease = async () => {
    if (!leaseUrl) return;
    
    setLoading(true);
    try {
      // Download as blob to avoid ad blocker issues
      const { data, error } = await supabase.storage
        .from("leases")
        .download(leaseUrl);
      
      if (data) {
        const url = URL.createObjectURL(data);
        window.open(url, "_blank");
      } else {
        console.error("Error downloading PDF:", error);
      }
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
