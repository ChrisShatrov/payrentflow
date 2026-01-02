import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign, User, AlertTriangle } from "lucide-react";

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
}

export function UnitDetailSheet({ unit, open, onOpenChange }: UnitDetailSheetProps) {
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
