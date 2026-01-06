import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, File, Download, Loader2, X } from "lucide-react";
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
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);

  const handleViewLease = async () => {
    if (!leaseUrl || !unitId) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to view documents");
        return;
      }

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

      // Convert to base64 data URL instead of blob URL to avoid ad blockers
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setPdfDataUrl(dataUrl);
        setShowPdfViewer(true);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Error viewing lease:", error);
      toast.error("Failed to load lease document");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadLease = async () => {
    if (!leaseUrl || !unitId) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to download documents");
        return;
      }

      const response = await fetch(
        `https://heismaqehgqxcrndtqmz.supabase.co/functions/v1/serve-lease-pdf?unitId=${unitId}`,
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
      a.download = `lease-${unitId}.pdf`;
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

  const closePdfViewer = () => {
    setShowPdfViewer(false);
    setPdfDataUrl(null);
  };

  // Full-screen PDF viewer
  if (showPdfViewer && pdfDataUrl) {
    return (
      <Dialog open={true} onOpenChange={closePdfViewer}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 overflow-hidden">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Lease Agreement</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadLease} disabled={loading}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button variant="ghost" size="icon" onClick={closePdfViewer}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 bg-muted">
              <iframe
                src={pdfDataUrl}
                className="w-full h-full border-0"
                title="Lease Agreement PDF"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
            <div className="flex gap-2">
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
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    View
                  </>
                ) : (
                  "Pending"
                )}
              </Button>
              {leaseUrl && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  disabled={loading}
                  onClick={handleDownloadLease}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
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
