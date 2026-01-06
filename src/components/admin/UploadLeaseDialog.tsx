import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UploadLeaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unitId: string;
  unitNumber: string;
  tenantName: string;
  currentLeaseUrl?: string | null;
  onLeaseUploaded: () => void;
}

export function UploadLeaseDialog({
  open,
  onOpenChange,
  unitId,
  unitNumber,
  tenantName,
  currentLeaseUrl,
  onLeaseUploaded,
}: UploadLeaseDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Please select a PDF file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    setUploading(true);
    try {
      const filePath = `${unitId}/lease.pdf`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("leases")
        .upload(filePath, selectedFile, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get signed URL (valid for 1 year)
      const { data: urlData, error: urlError } = await supabase.storage
        .from("leases")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      if (urlError) throw urlError;

      // Update unit with lease URL
      const { error: updateError } = await supabase
        .from("units")
        .update({ lease_pdf_url: urlData.signedUrl })
        .eq("id", unitId);

      if (updateError) throw updateError;

      toast.success("Lease uploaded successfully");
      setSelectedFile(null);
      onOpenChange(false);
      onLeaseUploaded();
    } catch (error: any) {
      console.error("Error uploading lease:", error);
      toast.error(error.message || "Failed to upload lease");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLease = async () => {
    setUploading(true);
    try {
      const filePath = `${unitId}/lease.pdf`;

      // Remove from storage
      await supabase.storage.from("leases").remove([filePath]);

      // Update unit to remove lease URL
      const { error: updateError } = await supabase
        .from("units")
        .update({ lease_pdf_url: null })
        .eq("id", unitId);

      if (updateError) throw updateError;

      toast.success("Lease removed successfully");
      onOpenChange(false);
      onLeaseUploaded();
    } catch (error: any) {
      console.error("Error removing lease:", error);
      toast.error(error.message || "Failed to remove lease");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Lease Agreement</DialogTitle>
          <DialogDescription>
            Upload a signed lease PDF for {tenantName} in Unit {unitNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {currentLeaseUrl && (
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm">Current lease uploaded</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveLease}
                disabled={uploading}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            accept="application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          {selectedFile ? (
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm truncate max-w-[200px]">{selectedFile.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full h-24 border-dashed"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Click to select PDF file
                </span>
              </div>
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={uploading || !selectedFile}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload Lease"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}