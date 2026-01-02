import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Calendar, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Unit {
  id: string;
  unit_number: string;
  monthly_rent: number;
  tenant_id: string | null;
}

interface PropertyDetailSheetProps {
  property: {
    id: string;
    name: string;
    address: string;
    created_at: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PropertyDetailSheet({ property, open, onOpenChange }: PropertyDetailSheetProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (property && open) {
      fetchUnits();
    }
  }, [property, open]);

  const fetchUnits = async () => {
    if (!property) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("units")
        .select("id, unit_number, monthly_rent, tenant_id")
        .eq("property_id", property.id)
        .order("unit_number");

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error("Error fetching units:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!property) return null;

  const occupiedUnits = units.filter(u => u.tenant_id).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {property.name}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {property.address}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Total Units</p>
              <p className="text-2xl font-bold">{units.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Occupied</p>
              <p className="text-2xl font-bold">{occupiedUnits}</p>
            </div>
          </div>

          {/* Created Date */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Added on {new Date(property.created_at).toLocaleDateString()}</span>
          </div>

          {/* Units List */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Home className="h-4 w-4" />
              Units
            </h4>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading units...</p>
            ) : units.length === 0 ? (
              <p className="text-sm text-muted-foreground">No units added yet.</p>
            ) : (
              <div className="space-y-2">
                {units.map((unit) => (
                  <div
                    key={unit.id}
                    className="flex items-center justify-between p-3 bg-card border border-border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">Unit {unit.unit_number}</p>
                      <p className="text-sm text-muted-foreground">
                        ${unit.monthly_rent.toLocaleString()}/mo
                      </p>
                    </div>
                    <Badge variant={unit.tenant_id ? "default" : "secondary"}>
                      {unit.tenant_id ? "Occupied" : "Vacant"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
