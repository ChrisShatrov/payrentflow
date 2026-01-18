import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link2, CheckCircle2, Loader2 } from "lucide-react";

interface DocuSignIntegration {
  id: string;
  account_id: string;
  account_name: string | null;
  created_at: string;
}

export function DocuSignConnectDialog() {
  const [open, setOpen] = useState(false);
  const [integration, setIntegration] = useState<DocuSignIntegration | null>(null);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [redirectUri, setRedirectUri] = useState<string>("");

  useEffect(() => {
    if (open) {
      checkConnection();
      // Get the redirect URI from environment variable
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      if (supabaseUrl) {
        const baseUrl = supabaseUrl.replace('/rest/v1', '');
        setRedirectUri(`${baseUrl}/functions/v1/docusign-callback`);
      } else {
        // Fallback: construct from current hostname if on Supabase
        const host = window.location.hostname;
        if (host.includes('supabase.co')) {
          const projectRef = host.split('.')[0];
          setRedirectUri(`https://${projectRef}.supabase.co/functions/v1/docusign-callback`);
        } else {
          // Show placeholder with instructions
          setRedirectUri('https://your-project.supabase.co/functions/v1/docusign-callback');
        }
      }
    }
  }, [open]);

  const checkConnection = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("docusign_integrations")
        .select("*")
        .eq("landlord_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      setIntegration(data);
    } catch (error: any) {
      console.error("Error checking connection:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("docusign-connect");

      if (error) {
        console.error("DocuSign connect error:", error);
        throw new Error(error.message || "Failed to connect to DocuSign");
      }
      
      if (data?.error) {
        console.error("DocuSign connect data error:", data.error);
        throw new Error(data.error);
      }

      if (data?.auth_url) {
        // Redirect to DocuSign OAuth
        console.log("Redirecting to DocuSign OAuth:", data.auth_url);
        window.location.href = data.auth_url;
      } else if (data?.connected) {
        // Already connected
        toast.success("Already connected to DocuSign");
        checkConnection();
      } else {
        throw new Error("Unexpected response from DocuSign connect function");
      }
    } catch (error: any) {
      console.error("Error connecting to DocuSign:", error);
      const errorMessage = error.message || error.toString() || "Failed to connect to DocuSign";
      toast.error(errorMessage);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect DocuSign?")) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("docusign_integrations")
        .delete()
        .eq("landlord_id", user.id);

      if (error) throw error;
      toast.success("DocuSign disconnected");
      setIntegration(null);
    } catch (error: any) {
      toast.error("Failed to disconnect DocuSign");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Link2 className="h-4 w-4 mr-2" />
          DocuSign Integration
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>DocuSign Integration</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : integration ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Connected to DocuSign</span>
              </div>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm">
                  <strong>Account ID:</strong> {integration.account_id}
                </p>
                {integration.account_name && (
                  <p className="text-sm">
                    <strong>Account Name:</strong> {integration.account_name}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Connected on {new Date(integration.created_at).toLocaleDateString()}
                </p>
              </div>
              <Button variant="destructive" onClick={handleDisconnect} className="w-full">
                Disconnect DocuSign
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Connect your DocuSign account to enable electronic signatures for lease agreements.
              </p>
              
              <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 text-lg">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
                      Important: Register Redirect URI in DocuSign First
                    </p>
                    <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">
                      Before clicking "Connect DocuSign", you must add this exact redirect URI to your DocuSign Integration:
                    </p>
                    <div className="bg-white dark:bg-gray-900 p-3 rounded border border-amber-300 dark:border-amber-700">
                      <code className="text-xs break-all text-amber-900 dark:text-amber-100">
                        {redirectUri || 'Loading...'}
                      </code>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-amber-800 dark:text-amber-200">
                      <p><strong>Steps to register:</strong></p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Go to <a href="https://developers.docusign.com" target="_blank" rel="noopener noreferrer" className="underline">DocuSign Developer Center</a></li>
                        <li>Navigate to your Integration (App)</li>
                        <li>Click "Edit" or "Settings"</li>
                        <li>Find "Redirect URIs" section</li>
                        <li>Click "Add URI" and paste the URL above</li>
                        <li>Save the changes</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full"
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4 mr-2" />
                    Connect DocuSign
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
