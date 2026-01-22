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
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      // Use the database function to get only tenants with confirmed emails and no unit assigned
      const { data, error } = await supabase.rpc('get_available_tenants' as any);

      if (error) {
        console.error("Error fetching available tenants:", error);
        // Fallback: try the old method if function doesn't exist
        const { data: assignedUnits } = await supabase
          .from("units")
          .select("tenant_id")
          .not("tenant_id", "is", null);

        const assignedTenantIds = (assignedUnits || []).map((u) => u.tenant_id);

        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("role", "tenant");

        if (profilesError) throw profilesError;

        const availableTenants = (profilesData || []).filter(
          (t) => !assignedTenantIds.includes(t.id)
        );

        setTenants(availableTenants);
        return;
      }

      setTenants(data || []);
    } catch (error) {
      console.error("Error fetching tenants:", error);
    }
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

    setLoading(true);
    try {
      const { error } = await supabase.from("units").insert({
        property_id: propertyId,
        unit_number: unitNumber.trim(),
        tenant_id: tenantId === "__none__" ? null : tenantId || null,
        monthly_rent: parseFloat(monthlyRent),
        due_day: dueDayNum,
        allow_split_payment: allowSplitPayment,
        split_payment_fee: allowSplitPayment ? parseFloat(splitPaymentFee) || 30.00 : null,
        late_fee_amount: parseFloat(lateFeeAmount) || 0,
        daily_late_fee: parseFloat(dailyLateFee) || 0,
        move_in_date: moveInDate || null,
        first_month_paid: tenantId && tenantId !== "__none__" ? firstMonthPaid : false,
      });

      if (error) throw error;

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
              <Select value={tenantId || "__none__"} onValueChange={(value) => {
                setTenantId(value);
                // Clear move-in date and first month paid if tenant is removed
                if (value === "__none__") {
                  setMoveInDate("");
                  setFirstMonthPaid(false);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a tenant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No tenant</SelectItem>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.full_name 
                        ? `${tenant.full_name} (${tenant.email})`
                        : tenant.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tenants.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No available tenants. Add tenants in the Tenants tab first.
                </p>
              )}
            </div>

            {/* Move In Date - only show when tenant is assigned */}
            {tenantId && tenantId !== "__none__" && (
              <div className="grid gap-2">
                <Label htmlFor="moveInDate">Move In Date (optional)</Label>
                <Input
                  id="moveInDate"
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  The date when the tenant moves in. Used to calculate pro-rated rent for the first month.
                </p>
              </div>
            )}

            {/* First Month Paid - only show when tenant is assigned */}
            {tenantId && tenantId !== "__none__" && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="firstMonthPaid"
                  checked={firstMonthPaid}
                  onCheckedChange={(checked) => setFirstMonthPaid(checked === true)}
                  disabled={loading}
                />
                <Label htmlFor="firstMonthPaid" className="text-sm font-normal cursor-pointer">
                  First month has been paid (tenant not responsible for current month)
                </Label>
              </div>
            )}

            {/* Pro-rated Rent Display - only show when tenant is assigned, move-in date is set, and not first of month */}
            {tenantId && tenantId !== "__none__" && moveInDate && monthlyRent && (
              (() => {
                const prorated = calculateProratedRent(moveInDate, parseFloat(monthlyRent));
                if (prorated === null) return null;
                return (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm font-medium text-foreground mb-1">Pro-rated Rent for Move-In Month</p>
                    <p className="text-xs text-muted-foreground">
                      Monthly Rent: ${parseFloat(monthlyRent).toFixed(2)}
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
