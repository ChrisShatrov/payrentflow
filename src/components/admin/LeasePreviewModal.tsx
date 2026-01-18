import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface LeasePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  leaseData: Record<string, any>;
}

export function LeasePreviewModal({
  open,
  onOpenChange,
  templateId,
  leaseData,
}: LeasePreviewModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && templateId) {
      generatePreview();
    } else {
      setPdfUrl(null);
    }
  }, [open, templateId, leaseData]);

  const generatePreview = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-lease-pdf", {
        body: {
          template_id: templateId,
          lease_data_json: leaseData,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPdfUrl(data.pdf_url);
    } catch (error: any) {
      console.error("Error generating preview:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Lease Preview</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-[600px] border rounded"
              title="Lease Preview"
            />
          ) : (
            <div className="text-center p-8 text-muted-foreground">
              Failed to load preview
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
