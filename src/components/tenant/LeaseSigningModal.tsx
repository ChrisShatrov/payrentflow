import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Lease {
  id: string;
  status: string;
  docusign_envelope_id: string | null;
}

interface LeaseSigningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lease: Lease;
  onComplete: () => void;
}

export function LeaseSigningModal({
  open,
  onOpenChange,
  lease,
  onComplete,
}: LeaseSigningModalProps) {
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    if (open && lease && !signed) {
      fetchSigningUrl();
    }
  }, [open, lease]);

  const fetchSigningUrl = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-embedded-signing-url", {
        body: {
          lease_id: lease.id,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSigningUrl(data.signing_url);
    } catch (error: any) {
      console.error("Error fetching signing URL:", error);
      toast.error(error.message || "Failed to load signing interface");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  // Listen for postMessage from DocuSign iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // DocuSign sends events when signing is complete
      if (event.data && typeof event.data === "string") {
        try {
          const data = JSON.parse(event.data);
          if (data.event === "signing_complete" || data.event === "envelope_complete") {
            setSigned(true);
            toast.success("Lease signed successfully!");
            setTimeout(() => {
              onComplete();
              onOpenChange(false);
            }, 2000);
          }
        } catch (e) {
          // Not a JSON message, ignore
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onComplete, onOpenChange]);

  // Poll for status changes (fallback if postMessage doesn't work)
  useEffect(() => {
    if (!open || signed) return;

    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from("leases")
          .select("status")
          .eq("id", lease.id)
          .single();

        if (data && (data.status === "signed" || data.status === "completed")) {
          setSigned(true);
          toast.success("Lease signed successfully!");
          clearInterval(interval);
          setTimeout(() => {
            onComplete();
            onOpenChange(false);
          }, 2000);
        }
      } catch (error) {
        // Ignore polling errors
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [open, lease.id, signed, onComplete, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Sign Lease Agreement</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {signed ? (
            <div className="flex flex-col items-center justify-center h-96 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <h3 className="text-xl font-semibold">Lease Signed Successfully!</h3>
              <p className="text-muted-foreground">
                Your lease agreement has been signed and executed.
              </p>
              <Button onClick={() => {
                onComplete();
                onOpenChange(false);
              }}>
                Close
              </Button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : signingUrl ? (
            <iframe
              src={signingUrl}
              className="w-full h-[600px] border rounded"
              title="DocuSign Signing"
              allow="camera; microphone; geolocation"
            />
          ) : (
            <div className="text-center p-8 text-muted-foreground">
              Failed to load signing interface
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
