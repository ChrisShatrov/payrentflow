import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Calendar, Home, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AddUnitDialog } from "./AddUnitDialog";
import { UnitDetailSheet } from "./UnitDetailSheet";

interface Unit {
  id: string;
  unit_number: string;
  monthly_rent: number;
  due_day: number;
  allow_split_payment: boolean;
  late_fee_amount: number;
  daily_late_fee: number;
  tenant_id: string | null;
  tenantName?: string | null;
  tenantEmail?: string | null;
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
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [unitSheetOpen, setUnitSheetOpen] = useState(false);

  useEffect(() => {
    if (property && open) {
      fetchUnits();
    }
  }, [property, open]);

  const fetchUnits = async () => {
    if (!property) return;
    
    setLoading(true);
    try {
      const { data: unitsData, error: unitsError } = await supabase
        .from("units")
        .select("id, unit_number, monthly_rent, due_day, allow_split_payment, late_fee_amount, daily_late_fee, tenant_id")
        .eq("property_id", property.id)
        .order("unit_number");

      if (unitsError) throw unitsError;

      // Fetch tenant info for occupied units
      const tenantIds = (unitsData || [])
        .filter((u) => u.tenant_id)
        .map((u) => u.tenant_id);

      let tenantMap: Record<string, { full_name: string | null; email: string }> = {};
      
      if (tenantIds.length > 0) {
        const { data: tenants } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", tenantIds);

        tenantMap = (tenants || []).reduce((acc, t) => {
          acc[t.id] = { full_name: t.full_name, email: t.email };
          return acc;
        }, {} as Record<string, { full_name: string | null; email: string }>);
      }

      const unitsWithTenants = (unitsData || []).map((unit) => ({
        ...unit,
        tenantName: unit.tenant_id ? tenantMap[unit.tenant_id]?.full_name : null,
        tenantEmail: unit.tenant_id ? tenantMap[unit.tenant_id]?.email : null,
      }));

      setUnits(unitsWithTenants);
    } catch (error) {
      console.error("Error fetching units:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnitClick = (unit: Unit) => {
    setSelectedUnit(unit);
    setUnitSheetOpen(true);
  };

  if (!property) return null;

  const occupiedUnits = units.filter(u => u.tenant_id).length;

  return (
    <>
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
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Units
                </h4>
                <AddUnitDialog propertyId={property.id} onUnitAdded={fetchUnits} />
              </div>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading units...</p>
              ) : units.length === 0 ? (
                <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed border-border">
                  <Home className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No units added yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click "Add Unit" to get started.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {units.map((unit) => (
                    <div
                      key={unit.id}
                      onClick={() => handleUnitClick(unit)}
                      className="flex items-center justify-between p-3 bg-card border border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors group"
                    >
                      <div>
                        <p className="font-medium">Unit {unit.unit_number}</p>
                        <p className="text-sm text-muted-foreground">
                          ${unit.monthly_rent.toLocaleString()}/mo
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={unit.tenant_id ? "default" : "secondary"}>
                          {unit.tenant_id ? "Occupied" : "Vacant"}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <UnitDetailSheet
        unit={selectedUnit}
        open={unitSheetOpen}
        onOpenChange={setUnitSheetOpen}
        onUnitUpdated={fetchUnits}
      />
    </>
  );
}
