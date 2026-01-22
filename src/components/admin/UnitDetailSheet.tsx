import { useState, useEffect, useRef } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar, DollarSign, User, AlertTriangle, Pencil, Check, X, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Tenant {
  id: string;
  full_name: string | null;
  email: string;
}

interface UnitDetailSheetProps {
  unit: {
    id: string;
    unit_number: string;
    monthly_rent: number;
    due_day: number;
    allow_split_payment: boolean;
    split_payment_fee: number | null;
    late_fee_amount: number;
    daily_late_fee: number;
    tenant_id: string | null;
    first_month_paid?: boolean;
    move_in_date?: string | null;
    tenantName?: string | null;
    tenantEmail?: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnitUpdated?: () => void;
}

export function UnitDetailSheet({ unit, open, onOpenChange, onUnitUpdated }: UnitDetailSheetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantComboboxOpen, setTenantComboboxOpen] = useState(false);
  const [showTenantWarning, setShowTenantWarning] = useState(false);
  const [pendingTenantId, setPendingTenantId] = useState<string>("");
  const isConfirmingRef = useRef(false); // Use ref to track confirmation state synchronously
  const [formData, setFormData] = useState({
    monthly_rent: 0,
    due_day: 1,
    late_fee_amount: 0,
    daily_late_fee: 0,
    allow_split_payment: false,
    split_payment_fee: 30.00,
    tenant_id: "",
    first_month_paid: false,
    move_in_date: "",
  });

  const fetchTenants = async () => {
    try {
      // Use the database function to get all assigned tenant IDs
      // This bypasses RLS and can see ALL units across ALL landlords
      let assignedTenantIds = new Set<string>();
      
      try {
        const { data: assignedTenantIdsData, error: assignedIdsError } = await (supabase.rpc as any)('get_all_assigned_tenant_ids');

        if (assignedIdsError) {
          console.error("[UnitDetailSheet] Error fetching assigned tenant IDs from function:", assignedIdsError);
          console.log("[UnitDetailSheet] Falling back to direct query (RLS-limited - may miss some assignments)");
          
          // Fallback to direct query (will be limited by RLS to current landlord's units only)
          const { data: assignedUnits } = await supabase
            .from("units")
            .select("tenant_id")
            .not("tenant_id", "is", null);

          (assignedUnits || []).forEach((u: any) => {
            if (u.tenant_id) {
              assignedTenantIds.add(String(u.tenant_id));
            }
          });
          console.log("[UnitDetailSheet] Using fallback query (RLS-limited):", Array.from(assignedTenantIds));
        } else {
          // Successfully got data from function
          (assignedTenantIdsData || []).forEach((item: any) => {
            if (item.tenant_id) {
              assignedTenantIds.add(String(item.tenant_id));
            }
          });
          console.log("[UnitDetailSheet] Assigned tenant IDs from function:", Array.from(assignedTenantIds));
        }
      } catch (error) {
        console.error("[UnitDetailSheet] Exception calling get_all_assigned_tenant_ids:", error);
        // Continue with empty set - will show all tenants (not ideal but better than crashing)
      }

      console.log("[UnitDetailSheet] Assigned tenant IDs (normalized):", Array.from(assignedTenantIds));

      // Get all tenant profiles
      const { data: allTenants, error: tenantsError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "tenant")
        .order("full_name", { ascending: true, nullsFirst: false });

      if (tenantsError) {
        console.error("[UnitDetailSheet] Error fetching profiles:", tenantsError);
        throw tenantsError;
      }

      console.log("[UnitDetailSheet] All tenant profiles:", allTenants);

      // Filter out assigned tenants, but include current unit's tenant if it exists (for reassignment)
      // Normalize IDs for comparison
      const currentUnitTenantIdStr = unit?.tenant_id ? String(unit.tenant_id) : null;
      let tenants: Tenant[] = (allTenants || []).filter((t) => {
        const tenantIdStr = String(t.id);
        const isAssigned = assignedTenantIds.has(tenantIdStr);
        const isCurrentUnitTenant = currentUnitTenantIdStr && tenantIdStr === currentUnitTenantIdStr;
        
        if (isAssigned && !isCurrentUnitTenant) {
          console.log(`[UnitDetailSheet] Filtering out assigned tenant: ${t.email} (${t.id})`);
        }
        
        return !isAssigned || isCurrentUnitTenant;
      }) as Tenant[];

      console.log("[UnitDetailSheet] Available tenants (including current unit tenant):", tenants);
      setTenants(tenants);
    } catch (error) {
      console.error("[UnitDetailSheet] Error fetching tenants:", error);
      toast.error("Failed to load tenants");
    }
  };

  // Get selected tenant display name
  const getSelectedTenantDisplay = () => {
    const currentTenantId = formData.tenant_id || "";
    if (!currentTenantId || currentTenantId === "__none__") {
      return "No tenant";
    }
    const tenant = tenants.find((t) => t.id === currentTenantId);
    if (!tenant) return "Select a tenant";
    return tenant.full_name 
      ? `${tenant.full_name} (${tenant.email})`
      : tenant.email;
  };

  useEffect(() => {
    if (isEditing && open && unit) {
      fetchTenants();
    }
  }, [isEditing, open, unit]);

  if (!unit) return null;

  const getOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return "th";
    switch (day % 10) {
      case 1: return "st";
      case 2: return "nd";
      case 3: return "rd";
      default: return "th";
    }
  };

  // Get tenant names for warning dialog - defined early so it's accessible in both views
  const getTenantName = (tenantId: string | null) => {
    if (!tenantId) return "No tenant";
    const tenant = tenants.find(t => t.id === tenantId);
    return tenant ? (tenant.full_name || tenant.email) : "Unknown";
  };

  // Define tenant change handlers before they're used in JSX
  const handleTenantChangeConfirm = () => {
    // Update formData with the confirmed tenant selection immediately
    // Store pendingTenantId in a variable before clearing it
    const confirmedTenantId = pendingTenantId;
    console.log("Confirming tenant change:", { 
      pendingTenantId, 
      confirmedTenantId,
      currentFormDataTenantId: formData.tenant_id,
      willSetTo: confirmedTenantId || ""
    });
    
    // Set confirming ref FIRST (synchronous) to prevent cancel handler from running
    isConfirmingRef.current = true;
    
    // Update formData with the confirmed tenant ID
    setFormData((prev) => {
      const newFormData = { ...prev, tenant_id: confirmedTenantId || "" };
      console.log("Updating formData.tenant_id:", { 
        from: prev.tenant_id, 
        to: newFormData.tenant_id 
      });
      return newFormData;
    });
    
    // Close dialog - the ref will prevent cancel from running
    setShowTenantWarning(false);
    setPendingTenantId("");
    
    // Reset confirming ref after dialog closes
    setTimeout(() => {
      isConfirmingRef.current = false;
    }, 100);
  };

  const handleTenantChangeCancel = () => {
    // Only cancel if we're not in the process of confirming
    if (isConfirmingRef.current) {
      console.log("Skipping cancel - confirmation in progress");
      return;
    }
    
    setShowTenantWarning(false);
    setPendingTenantId("");
    // Reset formData tenant_id to current unit's tenant_id
    setFormData((prev) => ({ ...prev, tenant_id: unit.tenant_id || "" }));
    console.log("Tenant selection cancelled, formData reset to:", { tenant_id: unit.tenant_id || "" });
  };

  const handleEdit = () => {
    // Format move_in_date for date input (YYYY-MM-DD)
    const moveInDateFormatted = unit.move_in_date 
      ? new Date(unit.move_in_date).toISOString().split('T')[0]
      : "";
    
    setFormData({
      monthly_rent: unit.monthly_rent,
      due_day: unit.due_day,
      late_fee_amount: unit.late_fee_amount,
      daily_late_fee: unit.daily_late_fee,
      allow_split_payment: unit.allow_split_payment,
      split_payment_fee: unit.split_payment_fee || 30.00,
      tenant_id: unit.tenant_id || "",
      first_month_paid: unit.first_month_paid || false,
      move_in_date: moveInDateFormatted,
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Track changes for email notification
      const changes: string[] = [];
      if (formData.monthly_rent !== unit.monthly_rent) {
        changes.push(`Monthly rent changed from $${unit.monthly_rent} to $${formData.monthly_rent}`);
      }
      if (formData.due_day !== unit.due_day) {
        changes.push(`Due day changed from ${unit.due_day} to ${formData.due_day}`);
      }
      if (formData.late_fee_amount !== unit.late_fee_amount) {
        changes.push(`Late fee changed from $${unit.late_fee_amount} to $${formData.late_fee_amount}`);
      }
      if (formData.daily_late_fee !== unit.daily_late_fee) {
        changes.push(`Daily late fee changed from $${unit.daily_late_fee} to $${formData.daily_late_fee}`);
      }
      if (formData.allow_split_payment !== unit.allow_split_payment) {
        changes.push(`Split payments ${formData.allow_split_payment ? 'enabled' : 'disabled'}`);
      }
      if (formData.allow_split_payment && formData.split_payment_fee !== (unit.split_payment_fee || 30.00)) {
        changes.push(`Split payment fee changed from $${unit.split_payment_fee || 30.00} to $${formData.split_payment_fee}`);
      }
      if (formData.first_month_paid !== (unit.first_month_paid || false)) {
        changes.push(`First month paid status changed from ${unit.first_month_paid ? 'paid' : 'unpaid'} to ${formData.first_month_paid ? 'paid' : 'unpaid'}`);
      }
      const currentMoveInDate = unit.move_in_date ? new Date(unit.move_in_date).toISOString().split('T')[0] : "";
      if (formData.move_in_date !== currentMoveInDate) {
        if (formData.move_in_date) {
          changes.push(`Move-in date changed from ${currentMoveInDate || 'not set'} to ${formData.move_in_date}`);
        } else {
          changes.push(`Move-in date removed`);
        }
      }
      if (formData.tenant_id !== (unit.tenant_id || "")) {
        const oldTenant = tenants.find(t => t.id === unit.tenant_id);
        const newTenant = tenants.find(t => t.id === formData.tenant_id);
        if (formData.tenant_id === "") {
          changes.push(`Tenant removed${oldTenant ? ` (${oldTenant.full_name || oldTenant.email})` : ""}`);
        } else if (unit.tenant_id === null) {
          changes.push(`Tenant assigned: ${newTenant?.full_name || newTenant?.email || "Unknown"}`);
        } else {
          changes.push(`Tenant changed from ${oldTenant?.full_name || oldTenant?.email || "Unknown"} to ${newTenant?.full_name || newTenant?.email || "Unknown"}`);
        }
      }

      const updateData: any = {
        monthly_rent: formData.monthly_rent,
        due_day: formData.due_day,
        late_fee_amount: formData.late_fee_amount,
        daily_late_fee: formData.daily_late_fee,
        allow_split_payment: formData.allow_split_payment,
        split_payment_fee: formData.allow_split_payment ? formData.split_payment_fee : null,
        first_month_paid: formData.first_month_paid,
        move_in_date: formData.move_in_date || null,
      };

      // Handle tenant_id update - explicitly set to null if empty string, otherwise use the value
      // Always include tenant_id in the update to ensure it's saved
      if (formData.tenant_id === "" || formData.tenant_id === "__none__" || !formData.tenant_id) {
        updateData.tenant_id = null;
      } else {
        updateData.tenant_id = formData.tenant_id;
      }
      
      console.log("Tenant ID update logic:", {
        formDataTenantId: formData.tenant_id,
        updateDataTenantId: updateData.tenant_id,
        currentUnitTenantId: unit.tenant_id,
        willUpdate: updateData.tenant_id !== unit.tenant_id
      });

      console.log("Updating unit with data:", { 
        unitId: unit.id, 
        updateData, 
        formDataTenantId: formData.tenant_id,
        currentTenantId: unit.tenant_id 
      });

      const { data: updatedUnit, error } = await supabase
        .from("units")
        .update(updateData)
        .eq("id", unit.id)
        .select("id, tenant_id")
        .single();

      if (error) {
        console.error("Error updating unit:", error);
        console.error("Update data that failed:", updateData);
        throw error;
      }

      if (!updatedUnit) {
        throw new Error("Unit update succeeded but no data returned");
      }

      console.log("Unit updated successfully:", updatedUnit);
      console.log("Updated tenant_id:", updatedUnit.tenant_id);
      
      // Verify the update worked by fetching again
      const { data: verifyUnit, error: verifyError } = await supabase
        .from("units")
        .select("id, tenant_id")
        .eq("id", unit.id)
        .single();
      
      if (verifyError) {
        console.error("Error verifying update:", verifyError);
      } else {
        console.log("Verified tenant_id after update:", verifyUnit?.tenant_id);
        if (verifyUnit?.tenant_id !== updateData.tenant_id) {
          console.error("WARNING: Tenant ID mismatch! Expected:", updateData.tenant_id, "Got:", verifyUnit?.tenant_id);
        }
      }

      // Auto-generate statement if tenant was just assigned with move-in date
      const wasTenantJustAssigned = (!unit.tenant_id || unit.tenant_id === "") && updateData.tenant_id;
      if (wasTenantJustAssigned && formData.move_in_date) {
        const today = new Date();
        const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
        const currentYear = today.getFullYear();
        const periodMonth = `${currentMonth}/${currentYear}`;
        
        console.log("Tenant just assigned with move-in date, generating statement for:", periodMonth);
        try {
          const { data: generatedStatement, error: generateError } = await supabase.functions.invoke("generate-statement", {
            body: { 
              unit_id: unit.id, 
              period_month: periodMonth 
            }
          });
          
          if (generateError) {
            console.error("Error generating statement:", generateError);
            // Don't show error to user - statement might already exist
          } else if (generatedStatement) {
            console.log("Statement generated successfully:", generatedStatement);
          }
        } catch (error) {
          console.error("Exception generating statement:", error);
          // Don't show error to user - statement might already exist
        }
      }

      // Send notification if there are changes and tenant is assigned
      if (changes.length > 0 && unit.tenant_id) {
        // Get property info for the email
        const { data: unitData } = await supabase
          .from("units")
          .select(`
            property_id,
            properties!inner(name, landlord_id)
          `)
          .eq("id", unit.id)
          .single();

        if (unitData) {
          const property = unitData.properties as any;
          // Fire and forget - don't block on email
          supabase.functions.invoke("send-notification-email", {
            body: {
              type: "unit_updated",
              tenant_id: unit.tenant_id,
              landlord_id: property?.landlord_id,
              data: {
                unit_number: unit.unit_number,
                property_name: property?.name,
                changes,
              },
            },
          }).catch(console.error);
        }
      }

      toast.success("Unit updated successfully");
      
      // Call onUnitUpdated to refresh the parent component's data BEFORE closing
      if (onUnitUpdated) {
        console.log("Calling onUnitUpdated to refresh parent data...");
        await onUnitUpdated(); // Wait for refresh to complete
        console.log("onUnitUpdated completed");
      }
      
      setIsEditing(false);
      
      // Close the sheet after a brief delay to ensure UI updates
      setTimeout(() => {
        onOpenChange(false);
      }, 200);
    } catch (error) {
      console.error("Error updating unit:", error);
      toast.error("Failed to update unit");
    } finally {
      setSaving(false);
    }
  };

  if (isEditing) {
    return (
      <>
        <Sheet open={open} onOpenChange={(newOpen) => {
          if (!newOpen) setIsEditing(false);
          onOpenChange(newOpen);
        }}>
          <SheetContent className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="flex items-center justify-between">
                <span>Edit Unit {unit.unit_number}</span>
                <Badge variant={unit.tenant_id ? "default" : "secondary"}>
                  {unit.tenant_id ? "Occupied" : "Vacant"}
                </Badge>
              </SheetTitle>
              <SheetDescription>Update unit rental settings</SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-5">
            {/* Assign Tenant */}
            <div className="space-y-2">
              <Label>Assign Tenant (optional)</Label>
              <Popover open={tenantComboboxOpen} onOpenChange={setTenantComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={tenantComboboxOpen}
                    className="w-full justify-between"
                    disabled={saving}
                  >
                    {getSelectedTenantDisplay()}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by email or name..." />
                    <CommandList>
                      <CommandEmpty>
                        {tenants.length === 0
                          ? "No available tenants. All tenants are assigned to units."
                          : "No tenants found."}
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="__none__"
                          onSelect={() => {
                            const currentUnitTenantId = unit.tenant_id || "";
                            if (currentUnitTenantId) {
                              setPendingTenantId("");
                              setShowTenantWarning(true);
                            } else {
                              setFormData((prev) => ({ ...prev, tenant_id: "" }));
                            }
                            setTenantComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              (!formData.tenant_id || formData.tenant_id === "__none__") ? "opacity-100" : "opacity-0"
                            )}
                          />
                          No tenant
                        </CommandItem>
                        {tenants.map((tenant) => {
                          const currentFormTenantId = formData.tenant_id || "";
                          const currentUnitTenantId = unit.tenant_id || "";
                          return (
                            <CommandItem
                              key={tenant.id}
                              value={`${tenant.full_name || ""} ${tenant.email}`}
                              onSelect={() => {
                                const newTenantId = tenant.id;
                                // If selecting the same tenant that's already in formData, no warning needed
                                if (newTenantId === currentFormTenantId) {
                                  setTenantComboboxOpen(false);
                                  return;
                                }
                                
                                // Show warning dialog if different from original unit tenant
                                if (newTenantId !== currentUnitTenantId) {
                                  setPendingTenantId(newTenantId);
                                  setShowTenantWarning(true);
                                } else {
                                  // If selecting back to the original tenant, just update formData directly
                                  setFormData((prev) => ({ ...prev, tenant_id: newTenantId }));
                                }
                                setTenantComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.tenant_id === tenant.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {tenant.full_name 
                                ? `${tenant.full_name} (${tenant.email})`
                                : tenant.email}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {/* Move In Date - only show when tenant is assigned */}
              {formData.tenant_id && formData.tenant_id !== "__none__" && (
                <div className="grid gap-2 pt-2">
                  <Label htmlFor="move_in_date">Move In Date (optional)</Label>
                  <Input
                    id="move_in_date"
                    type="date"
                    value={formData.move_in_date}
                    onChange={(e) => setFormData({ ...formData, move_in_date: e.target.value })}
                    disabled={saving}
                  />
                  <p className="text-xs text-muted-foreground">
                    The date when the tenant moves in. Used to calculate pro-rated rent for the first month.
                  </p>
                </div>
              )}
              {/* First Month Paid Checkbox - only show when tenant is assigned */}
              {formData.tenant_id && formData.tenant_id !== "__none__" && (
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="firstMonthPaid"
                    checked={formData.first_month_paid}
                    onCheckedChange={(checked) => setFormData({ ...formData, first_month_paid: checked === true })}
                    disabled={saving}
                  />
                  <Label htmlFor="firstMonthPaid" className="text-sm font-normal cursor-pointer">
                    First month has been paid (tenant not responsible for current month)
                  </Label>
                </div>
              )}
              {/* Pro-rated Rent Display - only show when tenant is assigned, move-in date is set, and not first of month */}
              {formData.tenant_id && formData.tenant_id !== "__none__" && formData.move_in_date && formData.monthly_rent > 0 && (
                (() => {
                  const calculateProratedRent = (moveInDate: string, monthlyRent: number): number | null => {
                    if (!moveInDate || !monthlyRent) return null;
                    
                    const moveIn = new Date(moveInDate);
                    const year = moveIn.getFullYear();
                    const month = moveIn.getMonth();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const moveInDay = moveIn.getDate();
                    const daysRemaining = daysInMonth - moveInDay + 1; // +1 to include move-in day
                    
                    if (daysRemaining === daysInMonth) return null; // Full month, no pro-rating needed
                    
                    const proratedAmount = (monthlyRent / daysInMonth) * daysRemaining;
                    return Math.round(proratedAmount * 100) / 100; // Round to 2 decimals
                  };
                  
                  const prorated = calculateProratedRent(formData.move_in_date, formData.monthly_rent);
                  if (prorated === null) return null;
                  return (
                    <div className="bg-muted/50 p-3 rounded-lg mt-2">
                      <p className="text-sm font-medium text-foreground mb-1">Pro-rated Rent for Move-In Month</p>
                      <p className="text-xs text-muted-foreground">
                        Monthly Rent: ${formData.monthly_rent.toFixed(2)}
                      </p>
                      <p className="text-lg font-semibold text-primary">
                        Pro-rated Amount: ${prorated.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This amount will be charged for the move-in month only.
                      </p>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Monthly Rent */}
            <div className="space-y-2">
              <Label htmlFor="monthly_rent">Monthly Rent ($)</Label>
              <Input
                id="monthly_rent"
                type="number"
                min="0"
                step="0.01"
                value={formData.monthly_rent}
                onChange={(e) => setFormData({ ...formData, monthly_rent: parseFloat(e.target.value) || 0 })}
              />
            </div>

            {/* Due Day */}
            <div className="space-y-2">
              <Label htmlFor="due_day">Due Day of Month</Label>
              <Input
                id="due_day"
                type="number"
                min="1"
                max="28"
                value={formData.due_day}
                onChange={(e) => setFormData({ ...formData, due_day: parseInt(e.target.value) || 1 })}
              />
              <p className="text-xs text-muted-foreground">Day of the month rent is due (1-28)</p>
            </div>

            {/* Late Fee Amount */}
            <div className="space-y-2">
              <Label htmlFor="late_fee_amount">Late Fee Amount ($)</Label>
              <Input
                id="late_fee_amount"
                type="number"
                min="0"
                step="0.01"
                value={formData.late_fee_amount}
                onChange={(e) => setFormData({ ...formData, late_fee_amount: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">Flat fee applied when payment is late</p>
            </div>

            {/* Daily Late Fee */}
            <div className="space-y-2">
              <Label htmlFor="daily_late_fee">Daily Late Fee ($)</Label>
              <Input
                id="daily_late_fee"
                type="number"
                min="0"
                step="0.01"
                value={formData.daily_late_fee}
                onChange={(e) => setFormData({ ...formData, daily_late_fee: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">Additional fee per day after due date</p>
            </div>

            {/* Allow Split Payment */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">Allow Split Payments</p>
                  <p className="text-sm text-muted-foreground">Let tenant pay in multiple installments</p>
                </div>
                <Switch
                  checked={formData.allow_split_payment}
                  onCheckedChange={(checked) => setFormData({ ...formData, allow_split_payment: checked })}
                />
              </div>
              {formData.allow_split_payment && (
                <div className="space-y-2">
                  <Label htmlFor="split_payment_fee">Split Payment Fee ($)</Label>
                  <Input
                    id="split_payment_fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.split_payment_fee}
                    onChange={(e) => setFormData({ ...formData, split_payment_fee: parseFloat(e.target.value) || 30.00 })}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                <Check className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Tenant Assignment Warning Dialog - Outside Sheet for proper modal rendering */}
      <AlertDialog open={showTenantWarning} onOpenChange={(open) => {
        if (!open && !isConfirmingRef.current) {
          // If dialog is closed without confirming (not via confirm button), reset the dropdown
          handleTenantChangeCancel();
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Tenant Assignment Change
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 pt-2">
              <p className="font-medium">You are about to change the tenant assignment for this unit:</p>
              <div className="bg-muted/50 p-3 rounded-lg space-y-1 text-sm">
                <p>
                  <span className="font-medium">Current tenant:</span> {getTenantName(unit.tenant_id)}
                </p>
                <p>
                  <span className="font-medium">New tenant:</span> {getTenantName(pendingTenantId || null)}
                </p>
              </div>
              <div className="pt-2 space-y-1">
                <p className="font-medium text-foreground">Please be aware:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>This will update the tenant assignment when you click "Save Changes"</li>
                  <li>If removing a tenant, they will lose access to this unit</li>
                  <li>If assigning a new tenant, they will gain access to this unit</li>
                  <li>Any existing statements and payments will remain associated with the previous tenant</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleTenantChangeCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleTenantChangeConfirm}>
              Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
    );
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between">
              <span>Unit {unit.unit_number}</span>
              <Badge variant={unit.tenant_id ? "default" : "secondary"}>
                {unit.tenant_id ? "Occupied" : "Vacant"}
              </Badge>
            </SheetTitle>
            <SheetDescription>Unit details and rental information</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
          {/* Monthly Rent */}
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="bg-primary/10 p-2 rounded-lg">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Monthly Rent</p>
              <p className="text-xl font-bold">${unit.monthly_rent.toLocaleString()}</p>
            </div>
          </div>

          {/* Due Date */}
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="bg-sky-100 p-2 rounded-lg">
              <Calendar className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Due Date</p>
              <p className="text-lg font-semibold">
                {unit.due_day}{getOrdinalSuffix(unit.due_day)} of each month
              </p>
            </div>
          </div>

          {/* Tenant Info */}
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <User className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tenant</p>
              {unit.tenant_id ? (
                <div>
                  <p className="font-semibold">{unit.tenantName || "Unknown"}</p>
                  {unit.tenantEmail && (
                    <p className="text-sm text-muted-foreground">{unit.tenantEmail}</p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">No tenant assigned</p>
              )}
            </div>
          </div>

          {/* Late Fees */}
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="bg-amber-100 p-2 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Late Fees</p>
              <p className="font-semibold">
                ${unit.late_fee_amount.toLocaleString()} flat fee
              </p>
              {unit.daily_late_fee > 0 && (
                <p className="text-sm text-muted-foreground">
                  + ${unit.daily_late_fee}/day after due date
                </p>
              )}
            </div>
          </div>

          {/* Split Payment */}
          {unit.allow_split_payment && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-sm text-primary font-medium">
                ✓ Split payments allowed
              </p>
            </div>
          )}

          {/* Edit Button */}
          <Button variant="outline" className="w-full" onClick={handleEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit Unit Settings
          </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Tenant Assignment Warning Dialog - Outside Sheet for proper modal rendering */}
      <AlertDialog open={showTenantWarning} onOpenChange={(open) => {
        if (!open && !isConfirmingRef.current) {
          // If dialog is closed without confirming (not via confirm button), reset the dropdown
          handleTenantChangeCancel();
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Tenant Assignment Change
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 pt-2">
              <p className="font-medium">You are about to change the tenant assignment for this unit:</p>
              <div className="bg-muted/50 p-3 rounded-lg space-y-1 text-sm">
                <p>
                  <span className="font-medium">Current tenant:</span> {getTenantName(unit.tenant_id)}
                </p>
                <p>
                  <span className="font-medium">New tenant:</span> {getTenantName(pendingTenantId || null)}
                </p>
              </div>
              <div className="pt-2 space-y-1">
                <p className="font-medium text-foreground">Please be aware:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>This will update the tenant assignment when you click "Save Changes"</li>
                  <li>If removing a tenant, they will lose access to this unit</li>
                  <li>If assigning a new tenant, they will gain access to this unit</li>
                  <li>Any existing statements and payments will remain associated with the previous tenant</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleTenantChangeCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleTenantChangeConfirm}>
              Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
