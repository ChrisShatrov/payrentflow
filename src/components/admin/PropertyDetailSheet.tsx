import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, MapPin, Calendar, Home, ChevronRight, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AddUnitDialog } from "./AddUnitDialog";
import { UnitDetailSheet } from "./UnitDetailSheet";
import { toast } from "sonner";

interface Unit {
  id: string;
  unit_number: string;
  monthly_rent: number;
  due_day: number;
  allow_split_payment: boolean;
  late_fee_amount: number;
  daily_late_fee: number;
  tenant_id: string | null;
  first_month_paid?: boolean;
  move_in_date?: string | null;
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
  onPropertyUpdated?: () => void;
}

export function PropertyDetailSheet({ property, open, onOpenChange, onPropertyUpdated }: PropertyDetailSheetProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [unitSheetOpen, setUnitSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [propertyData, setPropertyData] = useState<{
    name: string;
    address: string;
    allow_maintenance_requests: boolean;
  } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    allow_maintenance_requests: true,
  });

  useEffect(() => {
    if (property && open) {
      fetchProperty();
      fetchUnits();
    }
  }, [property, open]);

  const fetchProperty = async () => {
    if (!property) return;
    
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("name, address, allow_maintenance_requests")
        .eq("id", property.id)
        .single();

      if (error) throw error;

      const propertyInfo = {
        name: data.name,
        address: data.address,
        allow_maintenance_requests: data.allow_maintenance_requests ?? true,
      };

      setPropertyData(propertyInfo);
      setFormData(propertyInfo);
    } catch (error) {
      console.error("Error fetching property:", error);
      toast.error("Failed to load property details");
    }
  };

  const fetchUnits = async () => {
    if (!property) return;
    
    setLoading(true);
    try {
      const { data: unitsData, error: unitsError } = await supabase
        .from("units")
        .select("id, unit_number, monthly_rent, due_day, allow_split_payment, split_payment_fee, late_fee_amount, daily_late_fee, tenant_id, first_month_paid, move_in_date")
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
      
      // Update selectedUnit if it's currently open to reflect the latest data
      if (selectedUnit) {
        const updatedUnit = unitsWithTenants.find(u => u.id === selectedUnit.id);
        if (updatedUnit) {
          console.log("Updating selectedUnit with new data:", updatedUnit);
          setSelectedUnit(updatedUnit);
        }
      }
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

  const handleEdit = () => {
    if (propertyData) {
      setFormData({
        name: propertyData.name,
        address: propertyData.address,
        allow_maintenance_requests: propertyData.allow_maintenance_requests,
      });
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (propertyData) {
      setFormData({
        name: propertyData.name,
        address: propertyData.address,
        allow_maintenance_requests: propertyData.allow_maintenance_requests,
      });
    }
  };

  const handleSave = async () => {
    if (!property) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("properties")
        .update({
          name: formData.name.trim(),
          address: formData.address.trim(),
          allow_maintenance_requests: formData.allow_maintenance_requests,
        })
        .eq("id", property.id);

      if (error) throw error;

      toast.success("Property updated successfully");
      setIsEditing(false);
      await fetchProperty();
      if (onPropertyUpdated) {
        onPropertyUpdated();
      }
    } catch (error: any) {
      console.error("Error updating property:", error);
      toast.error(error.message || "Failed to update property");
    } finally {
      setSaving(false);
    }
  };

  if (!property) return null;

  const occupiedUnits = units.filter(u => u.tenant_id).length;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <SheetTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {isEditing ? (
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="max-w-xs"
                      disabled={saving}
                    />
                  ) : (
                    propertyData?.name || property.name
                  )}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-1.5 mt-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {isEditing ? (
                    <Textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="max-w-xs min-h-[60px]"
                      disabled={saving}
                    />
                  ) : (
                    propertyData?.address || property.address
                  )}
                </SheetDescription>
              </div>
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEdit}
                  className="ml-4"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Property
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Edit Form */}
            {isEditing && (
              <div className="bg-muted/30 rounded-lg p-4 space-y-4 border border-border">
                <div className="space-y-2">
                  <Label htmlFor="allow_maintenance">Enable Maintenance Requests</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="allow_maintenance"
                      checked={formData.allow_maintenance_requests}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, allow_maintenance_requests: checked === true })
                      }
                      disabled={saving}
                    />
                    <Label
                      htmlFor="allow_maintenance"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Allow tenants to submit maintenance requests for this property
                    </Label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving || !formData.name.trim() || !formData.address.trim()}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            )}

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
                        {unit.allow_split_payment && (
                          <Badge variant="outline" className="text-xs">
                            Split
                          </Badge>
                        )}
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
        key={selectedUnit?.id || 'no-unit'} // Force re-render when unit changes
        unit={selectedUnit}
        open={unitSheetOpen}
        onOpenChange={setUnitSheetOpen}
        onUnitUpdated={async () => {
          await fetchUnits();
          // Re-select the unit after refresh to ensure it has latest data
          if (selectedUnit) {
            const refreshedUnits = await supabase
              .from("units")
              .select("id, unit_number, monthly_rent, due_day, allow_split_payment, split_payment_fee, late_fee_amount, daily_late_fee, tenant_id, first_month_paid, move_in_date")
              .eq("id", selectedUnit.id)
              .single();
            
            if (refreshedUnits.data) {
              // Fetch tenant info if assigned
              if (refreshedUnits.data.tenant_id) {
                const { data: tenantData } = await supabase
                  .from("profiles")
                  .select("id, full_name, email")
                  .eq("id", refreshedUnits.data.tenant_id)
                  .single();
                
                setSelectedUnit({
                  ...refreshedUnits.data,
                  tenantName: tenantData?.full_name || null,
                  tenantEmail: tenantData?.email || null,
                });
              } else {
                setSelectedUnit({
                  ...refreshedUnits.data,
                  tenantName: null,
                  tenantEmail: null,
                });
              }
            }
          }
        }}
      />
    </>
  );
}
