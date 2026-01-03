import { useState } from "react";
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
import { Calendar, DollarSign, User, AlertTriangle, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UnitDetailSheetProps {
  unit: {
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
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnitUpdated?: () => void;
}

export function UnitDetailSheet({ unit, open, onOpenChange, onUnitUpdated }: UnitDetailSheetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    monthly_rent: 0,
    due_day: 1,
    late_fee_amount: 0,
    daily_late_fee: 0,
    allow_split_payment: false,
  });

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

  const handleEdit = () => {
    setFormData({
      monthly_rent: unit.monthly_rent,
      due_day: unit.due_day,
      late_fee_amount: unit.late_fee_amount,
      daily_late_fee: unit.daily_late_fee,
      allow_split_payment: unit.allow_split_payment,
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("units")
        .update({
          monthly_rent: formData.monthly_rent,
          due_day: formData.due_day,
          late_fee_amount: formData.late_fee_amount,
          daily_late_fee: formData.daily_late_fee,
          allow_split_payment: formData.allow_split_payment,
        })
        .eq("id", unit.id);

      if (error) throw error;

      toast.success("Unit updated successfully");
      setIsEditing(false);
      onUnitUpdated?.();
    } catch (error) {
      console.error("Error updating unit:", error);
      toast.error("Failed to update unit");
    } finally {
      setSaving(false);
    }
  };

  if (isEditing) {
    return (
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
    );
  }

  return (
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
  );
}
