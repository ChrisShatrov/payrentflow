import { useEffect, useState } from "react";
import { TenantLayout } from "@/components/tenant/TenantLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, Download, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { LeaseSigningModal } from "@/components/tenant/LeaseSigningModal";
import { LeaseStatusBadge } from "@/components/shared/LeaseStatusBadge";
import { useAuth } from "@/hooks/useAuth";

interface Lease {
  id: string;
  status: string;
  created_at: string;
  pdf_draft_url: string | null;
  pdf_signed_url: string | null;
  units: {
    unit_number: string;
    properties: {
      name: string;
      address: string;
    };
  };
  lease_templates: {
    name: string;
  };
}

export default function TenantLeases() {
  const { user } = useAuth();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingLease, setSigningLease] = useState<Lease | null>(null);
  const [signingModalOpen, setSigningModalOpen] = useState(false);

  const fetchLeases = async () => {
    try {
      const { data, error } = await supabase
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
          lease_templates(
            name
          )
        `)
        .eq("tenant_id", user?.id)
        .order("created_at", { ascending: false });

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
    if (user) {
      fetchLeases();
    }
  }, [user]);

  const handleSign = (lease: Lease) => {
    if (lease.status !== "sent" && lease.status !== "delivered") {
      toast.error("This lease is not ready for signing");
      return;
    }
    setSigningLease(lease);
    setSigningModalOpen(true);
  };

  const handleDownload = async (lease: Lease, type: "draft" | "signed") => {
    try {
      const url = type === "draft" ? lease.pdf_draft_url : lease.pdf_signed_url;
      if (!url) {
        toast.error(`${type === "draft" ? "Draft" : "Signed"} PDF not available`);
        return;
      }

      if (url.startsWith("http")) {
        window.open(url, "_blank");
      } else {
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

  const pendingLeases = leases.filter(
    (l) => l.status === "sent" || l.status === "delivered"
  );
  const completedLeases = leases.filter(
    (l) => l.status === "completed" || l.status === "signed"
  );

  return (
    <TenantLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Lease Agreements</h1>
          <p className="text-muted-foreground mt-1">View and sign your lease agreements</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Pending Signatures */}
            {pendingLeases.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Leases Requiring Signature
                </h2>
                <div className="space-y-4">
                  {pendingLeases.map((lease) => (
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
                            <strong>Property:</strong> {lease.units.properties.name} - Unit{" "}
                            {lease.units.unit_number}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Created {new Date(lease.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button onClick={() => handleSign(lease)}>
                          Review & Sign
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Leases */}
            {completedLeases.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Completed Leases
                </h2>
                <div className="space-y-4">
                  {completedLeases.map((lease) => (
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
                            <strong>Property:</strong> {lease.units.properties.name} - Unit{" "}
                            {lease.units.unit_number}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Completed {new Date(lease.updated_at || lease.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {lease.pdf_signed_url && (
                            <Button
                              variant="outline"
                              onClick={() => handleDownload(lease, "signed")}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No Leases */}
            {leases.length === 0 && (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No leases yet</h3>
                <p className="text-muted-foreground">
                  Your landlord will send you lease agreements to review and sign.
                </p>
              </div>
            )}
          </div>
        )}

        {signingLease && (
          <LeaseSigningModal
            open={signingModalOpen}
            onOpenChange={setSigningModalOpen}
            lease={signingLease}
            onComplete={() => {
              setSigningModalOpen(false);
              fetchLeases();
            }}
          />
        )}
      </div>
    </TenantLayout>
  );
}
