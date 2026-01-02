import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect } from "react";

interface Property {
  id: string;
  name: string;
  units: { id: string; unit_number: string }[];
}

interface InviteTenantDialogProps {
  onTenantInvited: () => void;
}

export function InviteTenantDialog({ onTenantInvited }: InviteTenantDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    if (open) {
      fetchProperties();
    }
  }, [open]);

  const fetchProperties = async () => {
    try {
      const { data: propertiesData, error: propertiesError } = await supabase
        .from("properties")
        .select("id, name");

      if (propertiesError) throw propertiesError;

      const { data: unitsData, error: unitsError } = await supabase
        .from("units")
        .select("id, unit_number, property_id")
        .is("tenant_id", null);

      if (unitsError) throw unitsError;

      const propertiesWithUnits = (propertiesData || []).map((p) => ({
        ...p,
        units: (unitsData || []).filter((u) => u.property_id === p.id),
      }));

      setProperties(propertiesWithUnits);
    } catch (error) {
      console.error("Error fetching properties:", error);
    }
  };

  const selectedPropertyUnits = properties.find((p) => p.id === selectedProperty)?.units || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !fullName.trim()) {
      toast.error("Please fill in email and full name");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      // Call edge function to send invite
      const { data, error } = await supabase.functions.invoke("send-tenant-invite", {
        body: {
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          unitId: selectedUnit || null,
        },
      });

      if (error) throw error;

      toast.success("Invite sent successfully!");
      setEmail("");
      setFullName("");
      setPhone("");
      setSelectedProperty("");
      setSelectedUnit("");
      setOpen(false);
      onTenantInvited();
    } catch (error: any) {
      console.error("Error sending invite:", error);
      toast.error(error.message || "Failed to send invite. Make sure RESEND_API_KEY is configured.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Mail className="h-4 w-4" />
          Invite Tenant
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite Tenant</DialogTitle>
            <DialogDescription>
              Send an email invitation to a new tenant to join your property.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="inviteFullName">Full Name *</Label>
              <Input
                id="inviteFullName"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inviteEmail">Email *</Label>
              <Input
                id="inviteEmail"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invitePhone">Phone (optional)</Label>
              <Input
                id="invitePhone"
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label>Property (optional)</Label>
              <Select value={selectedProperty} onValueChange={(v) => { setSelectedProperty(v); setSelectedUnit(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedProperty && selectedPropertyUnits.length > 0 && (
              <div className="grid gap-2">
                <Label>Unit (optional)</Label>
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedPropertyUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        Unit {unit.unit_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send Invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
