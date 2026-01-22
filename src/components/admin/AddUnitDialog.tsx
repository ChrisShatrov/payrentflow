import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Tenant {
  id: string;
  full_name: string | null;
  email: string;
}

interface AddUnitDialogProps {
  propertyId: string;
  onUnitAdded: () => void;
}

export function AddUnitDialog({ propertyId, onUnitAdded }: AddUnitDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantComboboxOpen, setTenantComboboxOpen] = useState(false);

  const [unitNumber, setUnitNumber] = useState("");
  const [tenantId, setTenantId] = useState<string>("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [allowSplitPayment, setAllowSplitPayment] = useState(false);
  const [splitPaymentFee, setSplitPaymentFee] = useState("30.00");
  const [lateFeeAmount, setLateFeeAmount] = useState("0");
  const [dailyLateFee, setDailyLateFee] = useState("0");
  const [moveInDate, setMoveInDate] = useState("");
  const [firstMonthPaid, setFirstMonthPaid] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTenants();
    }
  }, [open]);

  const fetchTenants = async () => {
    try {
      // Use the database function to get all assigned tenant IDs
      // This bypasses RLS and can see ALL units across ALL landlords
      let assignedTenantIds = new Set<string>();
      
      try {
        const { data: assignedTenantIdsData, error: assignedIdsError } = await (supabase.rpc as any)('get_all_assigned_tenant_ids');

        if (assignedIdsError) {
          console.error("[AddUnitDialog] Error fetching assigned tenant IDs from function:", assignedIdsError);
          console.log("[AddUnitDialog] Falling back to direct query (RLS-limited - may miss some assignments)");
          
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
          console.log("[AddUnitDialog] Using fallback query (RLS-limited):", Array.from(assignedTenantIds));
        } else {
          // Successfully got data from function
          (assignedTenantIdsData || []).forEach((item: any) => {
            if (item.tenant_id) {
              assignedTenantIds.add(String(item.tenant_id));
            }
          });
          console.log("[AddUnitDialog] Assigned tenant IDs from function:", Array.from(assignedTenantIds));
        }
      } catch (error) {
        console.error("[AddUnitDialog] Exception calling get_all_assigned_tenant_ids:", error);
        // Continue with empty set - will show all tenants (not ideal but better than crashing)
      }

      console.log("[AddUnitDialog] Assigned tenant IDs (normalized):", Array.from(assignedTenantIds));
      console.log("[AddUnitDialog] Total assigned tenants:", assignedTenantIds.size);

      // Get all tenant profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "tenant")
        .order("full_name", { ascending: true, nullsFirst: false });

      if (profilesError) {
        console.error("[AddUnitDialog] Error fetching profiles:", profilesError);
        setTenants([]);
        return;
      }

      console.log("[AddUnitDialog] All tenant profiles:", profilesData);
      console.log("[AddUnitDialog] Total tenant profiles:", profilesData?.length || 0);

      // Filter out assigned tenants - normalize IDs for comparison
      const availableTenants = (profilesData || []).filter((t) => {
        const tenantIdStr = String(t.id);
        const isAssigned = assignedTenantIds.has(tenantIdStr);
        if (isAssigned) {
          console.log(`[AddUnitDialog] Filtering out assigned tenant: ${t.email} (${t.id})`);
        }
        return !isAssigned;
      });

      console.log("[AddUnitDialog] Available (unassigned) tenants:", availableTenants);
      console.log("[AddUnitDialog] Total available tenants:", availableTenants.length);
      
      setTenants(availableTenants);
    } catch (error) {
      console.error("[AddUnitDialog] Error fetching tenants:", error);
      setTenants([]);
    }
  };

  // Get selected tenant display name
  const getSelectedTenantDisplay = () => {
    if (!tenantId || tenantId === "__none__") {
      return "No tenant";
    }
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) return "Select a tenant";
    return tenant.full_name 
      ? `${tenant.full_name} (${tenant.email})`
      : tenant.email;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!unitNumber.trim()) {
      toast.error("Please enter a unit number");
      return;
    }

    if (!monthlyRent || parseFloat(monthlyRent) <= 0) {
      toast.error("Please enter a valid monthly rent");
      return;
    }

    const dueDayNum = parseInt(dueDay);
    if (isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) {
      toast.error("Please enter a valid due day (1-31)");
      return;
    }

    // Validate move-in date if tenant is assigned
    if (tenantId && tenantId !== "__none__") {
      if (!moveInDate) {
        toast.error("Please enter a move-in date when assigning a tenant");
        return;
      }
    }

    setLoading(true);
    try {
      const { data: newUnit, error } = await supabase.from("units").insert({
        property_id: propertyId,
        unit_number: unitNumber.trim(),
        tenant_id: tenantId === "__none__" ? null : tenantId || null,
        monthly_rent: parseFloat(monthlyRent),
        due_day: dueDayNum,
        allow_split_payment: allowSplitPayment,
        split_payment_fee: allowSplitPayment ? parseFloat(splitPaymentFee) || 30.00 : null,
        late_fee_amount: parseFloat(lateFeeAmount) || 0,
        daily_late_fee: parseFloat(dailyLateFee) || 0,
        move_in_date: tenantId && tenantId !== "__none__" ? moveInDate : null,
        first_month_paid: tenantId && tenantId !== "__none__" ? firstMonthPaid : false,
      }).select("id").single();

      if (error) throw error;

      // Auto-generate statement if tenant was assigned with move-in date
      if (newUnit && tenantId && tenantId !== "__none__" && moveInDate) {
        const today = new Date();
        const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
        const currentYear = today.getFullYear();
        const periodMonth = `${currentMonth}/${currentYear}`;
        
        console.log("Unit created with tenant and move-in date, generating statement for:", periodMonth);
        try {
          const { data: generatedStatement, error: generateError } = await supabase.functions.invoke("generate-statement", {
            body: { 
              unit_id: newUnit.id, 
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

      toast.success("Unit added successfully");
      resetForm();
      setOpen(false);
      onUnitAdded();
    } catch (error: any) {
      console.error("Error adding unit:", error);
      toast.error(error.message || "Failed to add unit");
    } finally {
      setLoading(false);
    }
  };

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

  const resetForm = () => {
    setUnitNumber("");
    setTenantId("");
    setMonthlyRent("");
    setDueDay("1");
    setAllowSplitPayment(false);
    setSplitPaymentFee("30.00");
    setLateFeeAmount("0");
    setDailyLateFee("0");
    setMoveInDate("");
    setFirstMonthPaid(false);
    setTenantComboboxOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Unit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Unit</DialogTitle>
            <DialogDescription>
              Add a unit to this property with rental details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="unitNumber">Unit Number *</Label>
                <Input
                  id="unitNumber"
                  placeholder="e.g., 101, A1"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="monthlyRent">Monthly Rent ($) *</Label>
                <Input
                  id="monthlyRent"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="1500.00"
                  value={monthlyRent}
                  onChange={(e) => setMonthlyRent(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Assign Tenant (optional)</Label>
              <Popover open={tenantComboboxOpen} onOpenChange={setTenantComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={tenantComboboxOpen}
                    className="w-full justify-between"
                    disabled={loading}
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
                            setTenantId("");
                            setMoveInDate("");
                            setFirstMonthPaid(false);
                            setTenantComboboxOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              (!tenantId || tenantId === "__none__") ? "opacity-100" : "opacity-0"
                            )}
                          />
                          No tenant
                        </CommandItem>
                        {tenants.map((tenant) => (
                          <CommandItem
                            key={tenant.id}
                            value={`${tenant.full_name || ""} ${tenant.email}`}
                            onSelect={() => {
                              setTenantId(tenant.id);
                              setTenantComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                tenantId === tenant.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {tenant.full_name 
                              ? `${tenant.full_name} (${tenant.email})`
                              : tenant.email}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Move In Date - show when tenant is assigned */}
            {tenantId && tenantId !== "__none__" && (
              <div className="grid gap-2">
                <Label htmlFor="moveInDate">Move In Date *</Label>
                <Input
                  id="moveInDate"
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  disabled={loading}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The date when the tenant moves in. If first month is not paid, tenant will owe prorated rent from this date to the end of the month. If first month is paid, tenant won't owe anything until the due date of the following month.
                </p>
              </div>
            )}

            {/* First Month Paid - show when tenant is assigned */}
            {tenantId && tenantId !== "__none__" && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="firstMonthPaid"
                  checked={firstMonthPaid}
                  onCheckedChange={(checked) => setFirstMonthPaid(checked === true)}
                  disabled={loading}
                />
                <Label htmlFor="firstMonthPaid" className="text-sm font-normal cursor-pointer">
                  First month has been paid (tenant won't owe anything until the due date of the following month)
                </Label>
              </div>
            )}

            {/* Pro-rated Rent Display - show when tenant is assigned, move-in date is set */}
            {tenantId && tenantId !== "__none__" && moveInDate && monthlyRent && (
              (() => {
                const prorated = calculateProratedRent(moveInDate, parseFloat(monthlyRent));
                const monthlyRentValue = parseFloat(monthlyRent);
                
                return (
                  <div className="bg-muted/50 p-3 rounded-lg border border-border">
                    <p className="text-sm font-medium text-foreground mb-2">Rent Calculation for Move-In Month</p>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Monthly Rent: ${monthlyRentValue.toFixed(2)}
                      </p>
                      {prorated !== null ? (
                        <>
                          <p className="text-lg font-semibold text-primary">
                            Pro-rated Amount: ${prorated.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {firstMonthPaid 
                              ? "✅ First month paid - Tenant won't owe anything until the due date of the following month."
                              : "⚠️ First month NOT paid - Tenant will owe this prorated amount for the move-in month."}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {firstMonthPaid 
                            ? "✅ First month paid - Tenant won't owe anything until the due date of the following month."
                            : `Full month rent: $${monthlyRentValue.toFixed(2)} (move-in is on the 1st)`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()
            )}

            <div className="grid gap-2">
              <Label htmlFor="dueDay">Due Day of Month *</Label>
              <Select value={dueDay} onValueChange={setDueDay}>
                <SelectTrigger>
                  <SelectValue placeholder="Select due day" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      {day}{day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="lateFeeAmount">Late Fee ($)</Label>
                <Input
                  id="lateFeeAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="50.00"
                  value={lateFeeAmount}
                  onChange={(e) => setLateFeeAmount(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dailyLateFee">Daily Late Fee ($)</Label>
                <Input
                  id="dailyLateFee"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="5.00"
                  value={dailyLateFee}
                  onChange={(e) => setDailyLateFee(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Additional fee per day after due date
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="allowSplitPayment"
                  checked={allowSplitPayment}
                  onCheckedChange={(checked) => setAllowSplitPayment(checked === true)}
                  disabled={loading}
                />
                <Label htmlFor="allowSplitPayment" className="text-sm font-normal cursor-pointer">
                  Allow split payments
                </Label>
              </div>
              {allowSplitPayment && (
                <div className="grid gap-2 pl-6">
                  <Label htmlFor="splitPaymentFee" className="text-xs text-muted-foreground">
                    Split Payment Fee ($)
                  </Label>
                  <Input
                    id="splitPaymentFee"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="30.00"
                    value={splitPaymentFee}
                    onChange={(e) => setSplitPaymentFee(e.target.value)}
                    disabled={loading}
                    className="h-8"
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Unit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
