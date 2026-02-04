import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  FileText,
  Download,
  Calculator,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  XCircle,
  HelpCircle,
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  format,
} from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Loader2, Eye } from "lucide-react";
import { PdfViewerModal, type PdfViewerSource } from "@/components/shared/PdfViewerModal";

const REPORT_PRESET_KEY = "rentflow_reports_date_preset";
const REPORT_FROM_KEY = "rentflow_reports_date_from";
const REPORT_TO_KEY = "rentflow_reports_date_to";

function getPresetRange(preset: string): { from: Date; to: Date } {
  const now = new Date();
  switch (preset) {
    case "this_month":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "last_month":
      const last = subMonths(now, 1);
      return { from: startOfMonth(last), to: endOfMonth(last) };
    case "this_quarter":
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case "this_year":
      return { from: startOfYear(now), to: endOfYear(now) };
    default:
      return { from: startOfMonth(now), to: endOfMonth(now) };
  }
}

function formatDateForInput(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function StatementsTab({
  dateFrom,
  dateTo,
  selectedPropertyId,
  properties,
  formatCurrency: _fmt,
}: {
  dateFrom: string;
  dateTo: string;
  selectedPropertyId: string;
  properties: { id: string; name: string }[];
  formatCurrency: (n: number) => string;
}) {
  const [ownerLoading, setOwnerLoading] = useState<"pdf" | "json" | "view" | null>(null);
  const [pnlLoading, setPnlLoading] = useState<"pdf" | "json" | "view" | null>(null);
  const [viewPdfSource, setViewPdfSource] = useState<PdfViewerSource | null>(null);
  const [viewPdfOpen, setViewPdfOpen] = useState(false);
  const [viewPdfTitle, setViewPdfTitle] = useState("");
  const [viewPdfFilename, setViewPdfFilename] = useState("");

  const handleOwnerStatement = async (format: "pdf" | "json") => {
    setOwnerLoading(format);
    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in");
      const body = {
        start_date: dateFrom,
        end_date: dateTo,
        property_id: selectedPropertyId === "all" ? undefined : selectedPropertyId,
        format,
      };
      if (format === "pdf") {
        const res = await fetch(`${baseUrl}/functions/v1/generate-owner-statement`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            "apikey": key ?? "",
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? res.statusText);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `owner-statement-${dateFrom}-to-${dateTo}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Owner statement PDF downloaded");
      } else {
        const { data, error } = await supabase.functions.invoke("generate-owner-statement", { body });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        const str = JSON.stringify(data, null, 2);
        const blob = new Blob([str], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `owner-statement-${dateFrom}-to-${dateTo}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Owner statement JSON downloaded");
      }
    } catch (e) {
      console.error("Owner statement error:", e);
      toast.error(e instanceof Error ? e.message : "Failed to generate owner statement");
    } finally {
      setOwnerLoading(null);
    }
  };

  const handlePnlStatement = async (format: "pdf" | "json") => {
    setPnlLoading(format);
    try {
      const body = {
        start_date: dateFrom,
        end_date: dateTo,
        property_id: selectedPropertyId === "all" ? undefined : selectedPropertyId,
        format,
      };
      if (format === "pdf") {
        const baseUrl = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Not signed in");
        const res = await fetch(`${baseUrl}/functions/v1/generate-pnl-statement`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            "apikey": key ?? "",
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? res.statusText);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `pnl-statement-${dateFrom}-to-${dateTo}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("P&L PDF downloaded");
      } else {
        const { data, error } = await supabase.functions.invoke("generate-pnl-statement", { body });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        const str = JSON.stringify(data, null, 2);
        const blob = new Blob([str], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `pnl-statement-${dateFrom}-to-${dateTo}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("P&L JSON downloaded");
      }
    } catch (e) {
      console.error("P&L error:", e);
      toast.error(e instanceof Error ? e.message : "Failed to generate P&L statement");
    } finally {
      setPnlLoading(null);
    }
  };

  const handleViewOwnerPdf = async () => {
    setOwnerLoading("view");
    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in");
      const res = await fetch(`${baseUrl}/functions/v1/generate-owner-statement`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "apikey": key ?? "",
        },
        body: JSON.stringify({
          start_date: dateFrom,
          end_date: dateTo,
          property_id: selectedPropertyId === "all" ? undefined : selectedPropertyId,
          format: "pdf",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? res.statusText);
      }
      const blob = await res.blob();
      setViewPdfSource({ type: "blob", blob });
      setViewPdfTitle("Owner Statement");
      setViewPdfFilename(`owner-statement-${dateFrom}-to-${dateTo}.pdf`);
      setViewPdfOpen(true);
      toast.success("Owner statement opened");
    } catch (e) {
      console.error("Owner statement view error:", e);
      toast.error(e instanceof Error ? e.message : "Failed to load owner statement");
    } finally {
      setOwnerLoading(null);
    }
  };

  const handleViewPnlPdf = async () => {
    setPnlLoading("view");
    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in");
      const res = await fetch(`${baseUrl}/functions/v1/generate-pnl-statement`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "apikey": key ?? "",
        },
        body: JSON.stringify({
          start_date: dateFrom,
          end_date: dateTo,
          property_id: selectedPropertyId === "all" ? undefined : selectedPropertyId,
          format: "pdf",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? res.statusText);
      }
      const blob = await res.blob();
      setViewPdfSource({ type: "blob", blob });
      setViewPdfTitle("Profit & Loss Statement");
      setViewPdfFilename(`pnl-statement-${dateFrom}-to-${dateTo}.pdf`);
      setViewPdfOpen(true);
      toast.success("P&L statement opened");
    } catch (e) {
      console.error("P&L view error:", e);
      toast.error(e instanceof Error ? e.message : "Failed to load P&L statement");
    } finally {
      setPnlLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="font-semibold text-foreground mb-2">Owner statement (period-based)</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Summary of income, expenses, and payouts for the selected period. Same data as the dashboard for this range.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => handleOwnerStatement("pdf")}
            disabled={ownerLoading !== null}
          >
            {ownerLoading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
            Download PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => handleOwnerStatement("json")}
            disabled={ownerLoading !== null}
          >
            {ownerLoading === "json" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Download JSON
          </Button>
          <Button
            variant="outline"
            onClick={handleViewOwnerPdf}
            disabled={ownerLoading !== null}
          >
            {ownerLoading === "view" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            View PDF
          </Button>
        </div>
      </Card>
      <Card className="p-6">
        <h3 className="font-semibold text-foreground mb-2">Profit &amp; Loss statement</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Income by category, expenses by category, and net income for the selected period.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => handlePnlStatement("pdf")}
            disabled={pnlLoading !== null}
          >
            {pnlLoading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
            Download P&amp;L PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => handlePnlStatement("json")}
            disabled={pnlLoading !== null}
          >
            {pnlLoading === "json" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Download P&amp;L JSON
          </Button>
          <Button
            variant="outline"
            onClick={handleViewPnlPdf}
            disabled={pnlLoading !== null}
          >
            {pnlLoading === "view" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            View PDF
          </Button>
        </div>
      </Card>
      <PdfViewerModal
        open={viewPdfOpen}
        onOpenChange={(open) => {
          setViewPdfOpen(open);
          if (!open) setViewPdfSource(null);
        }}
        source={viewPdfSource}
        downloadFilename={viewPdfFilename}
        title={viewPdfTitle}
      />
      <Card className="p-6">
        <h3 className="font-semibold text-foreground mb-2">Tenant statements</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Generate or download tenant rent statements (PDF) from the Statements page per unit and period.
        </p>
        <Button variant="outline" asChild>
          <Link to="/admin/statements">
            <FileText className="h-4 w-4 mr-2" />
            Go to Statements
          </Link>
        </Button>
      </Card>
    </div>
  );
}

function ExportsTab({
  user,
  dateFrom,
  dateTo,
  selectedPropertyId,
  selectedUnitId,
  formatCurrency: fmt,
}: {
  user: { id: string } | null;
  dateFrom: string;
  dateTo: string;
  selectedPropertyId: string;
  selectedUnitId: string;
  formatCurrency: (n: number) => string;
}) {
  const [exporting, setExporting] = useState<string | null>(null);

  const exportTransactions = async () => {
    if (!user) return;
    setExporting("transactions");
    try {
      const { data, error } = await supabase.rpc("get_ledger_entries", {
        p_landlord_id: user.id,
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_property_id: selectedPropertyId === "all" ? null : selectedPropertyId,
        p_unit_id: selectedUnitId === "all" ? null : selectedUnitId,
        p_entry_types: null,
      });
      if (error) throw error;
      const rows = (data || []) as LedgerRow[];
      const headers = ["Date", "Type", "Amount", "Category", "Property", "Unit", "Tenant", "Description", "Reference Type"];
      const lines = [headers.join(",")];
      for (const r of rows) {
        lines.push([
          escapeCsvCell(r.entry_date),
          escapeCsvCell(r.entry_type),
          escapeCsvCell(Number(r.amount).toFixed(2)),
          escapeCsvCell(r.category_name),
          escapeCsvCell(r.property_name),
          escapeCsvCell(r.unit_number),
          escapeCsvCell(r.tenant_name),
          escapeCsvCell(r.description),
          escapeCsvCell(r.reference_type),
        ].join(","));
      }
      downloadCsv(`rentflow-transactions-${dateFrom}-to-${dateTo}.csv`, lines.join("\n"));
      toast.success("Transactions CSV downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export transactions");
    } finally {
      setExporting(null);
    }
  };

  const exportInvoices = async () => {
    if (!user) return;
    setExporting("invoices");
    try {
      const { data: propData } = await supabase.from("properties").select("id").eq("landlord_id", user.id);
      const propertyIds = (propData || []).map((p) => p.id);
      if (propertyIds.length === 0) {
        downloadCsv(`rentflow-invoices-${dateFrom}-to-${dateTo}.csv`, "Property,Unit,Tenant,Period,Base Rent,Late Fee,Additional Fees,Split Fee,Total Due,Status,Paid Amount\n");
        toast.success("Invoices CSV downloaded (no data)");
        return;
      }
      const { data: unitsData } = await supabase.from("units").select("id, unit_number, property_id, tenant_id").in("property_id", propertyIds);
      const unitIds = (unitsData || []).map((u) => u.id);
      const filterByProperty = selectedPropertyId !== "all";
      const filterByUnit = selectedUnitId !== "all";
      let filteredUnits = unitsData || [];
      if (filterByProperty) filteredUnits = filteredUnits.filter((u) => u.property_id === selectedPropertyId);
      if (filterByUnit) filteredUnits = filteredUnits.filter((u) => u.id === selectedUnitId);
      const filteredUnitIds = filteredUnits.map((u) => u.id);
      if (filteredUnitIds.length === 0) {
        downloadCsv(`rentflow-invoices-${dateFrom}-to-${dateTo}.csv`, "Property,Unit,Tenant,Period,Base Rent,Late Fee,Additional Fees,Split Fee,Total Due,Status,Paid Amount\n");
        toast.success("Invoices CSV downloaded (no data)");
        return;
      }
      const [fromY, fromM] = dateFrom.split("-").map(Number);
      const [toY, toM] = dateTo.split("-").map(Number);
      const { data: statements } = await supabase
        .from("statements")
        .select("id, unit_id, period_month, base_rent, late_fee, additional_fees, split_fee, total_due, status")
        .in("unit_id", filteredUnitIds);
      const statementIds = (statements || []).map((s) => s.id);
      const { data: paymentsData } = await supabase
        .from("payments")
        .select("statement_id, statement_amount")
        .in("statement_id", statementIds.length ? statementIds : ["00000000-0000-0000-0000-000000000000"])
        .in("status", ["completed", "paid"]);
      const paidByStmt = new Map<string, number>();
      (paymentsData || []).forEach((p) => {
        if (p.statement_id) paidByStmt.set(p.statement_id, (paidByStmt.get(p.statement_id) || 0) + Number(p.statement_amount || 0));
      });
      const tenantIds = [...new Set(filteredUnits.map((u) => u.tenant_id).filter(Boolean))] as string[];
      const { data: profiles } = tenantIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", tenantIds)
        : { data: [] };
      const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name ?? ""]));
      const { data: propNames } = await supabase.from("properties").select("id, name").eq("landlord_id", user.id);
      const propNameMap = new Map((propNames || []).map((p) => [p.id, p.name]));
      const unitMap = new Map(filteredUnits.map((u) => [u.id, u]));
      const headers = "Property,Unit,Tenant,Period,Base Rent,Late Fee,Additional Fees,Split Fee,Total Due,Status,Paid Amount";
      const lines = [headers];
      for (const s of statements || []) {
        const [month, year] = (s.period_month || "").split("/").map(Number);
        if (year < fromY || (year === fromY && month < fromM)) continue;
        if (year > toY || (year === toY && month > toM)) continue;
        const unit = unitMap.get(s.unit_id);
        const propName = unit ? propNameMap.get(unit.property_id) ?? "" : "";
        const unitNum = unit?.unit_number ?? "";
        const tenantName = unit?.tenant_id ? profileMap.get(unit.tenant_id) ?? "" : "";
        const paid = paidByStmt.get(s.id) ?? 0;
        lines.push([
          escapeCsvCell(propName),
          escapeCsvCell(unitNum),
          escapeCsvCell(tenantName),
          escapeCsvCell(s.period_month),
          escapeCsvCell(Number(s.base_rent ?? 0).toFixed(2)),
          escapeCsvCell(Number(s.late_fee ?? 0).toFixed(2)),
          escapeCsvCell(Number(s.additional_fees ?? 0).toFixed(2)),
          escapeCsvCell(Number(s.split_fee ?? 0).toFixed(2)),
          escapeCsvCell(Number(s.total_due ?? 0).toFixed(2)),
          escapeCsvCell(s.status),
          escapeCsvCell(paid.toFixed(2)),
        ].join(","));
      }
      downloadCsv(`rentflow-invoices-${dateFrom}-to-${dateTo}.csv`, lines.join("\n"));
      toast.success("Invoices CSV downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export invoices");
    } finally {
      setExporting(null);
    }
  };

  const exportPayments = async () => {
    if (!user) return;
    setExporting("payments");
    try {
      const { data: propData } = await supabase.from("properties").select("id").eq("landlord_id", user.id);
      const propertyIds = (propData || []).map((p) => p.id);
      const { data: unitsData } = await supabase.from("units").select("id, unit_number, property_id, tenant_id").in("property_id", propertyIds);
      let unitIds = (unitsData || []).map((u) => u.id);
      if (selectedPropertyId !== "all") unitIds = (unitsData || []).filter((u) => u.property_id === selectedPropertyId).map((u) => u.id);
      if (selectedUnitId !== "all") unitIds = unitIds.filter((id) => id === selectedUnitId);
      if (unitIds.length === 0) {
        downloadCsv(`rentflow-payments-${dateFrom}-to-${dateTo}.csv`, "Date,Property,Unit,Tenant,Amount,Method,Status\n");
        toast.success("Payments CSV downloaded (no data)");
        return;
      }
      const { data: payments } = await supabase
        .from("payments")
        .select("id, amount, payment_method, status, paid_at, created_at, unit_id")
        .in("unit_id", unitIds)
        .gte("paid_at", `${dateFrom}T00:00:00.000Z`)
        .lte("paid_at", `${dateTo}T23:59:59.999Z`);
      const units = (unitsData || []).filter((u) => unitIds.includes(u.id));
      const propIds = [...new Set(units.map((u) => u.property_id))];
      const { data: props } = await supabase.from("properties").select("id, name").in("id", propIds);
      const propMap = new Map((props || []).map((p) => [p.id, p.name]));
      const tenantIds = [...new Set(units.map((u) => u.tenant_id).filter(Boolean))] as string[];
      const { data: profs } = tenantIds.length ? await supabase.from("profiles").select("id, full_name").in("id", tenantIds) : { data: [] };
      const profMap = new Map((profs || []).map((p) => [p.id, p.full_name ?? ""]));
      const unitMap = new Map(units.map((u) => [u.id, u]));
      const lines = ["Date,Property,Unit,Tenant,Amount,Method,Status"];
      for (const p of payments || []) {
        const u = unitMap.get(p.unit_id);
        const propName = u ? propMap.get(u.property_id) ?? "" : "";
        const tenantName = u?.tenant_id ? profMap.get(u.tenant_id) ?? "" : "";
        const date = p.paid_at ? p.paid_at.slice(0, 10) : (p.created_at || "").slice(0, 10);
        lines.push([
          escapeCsvCell(date),
          escapeCsvCell(propName),
          escapeCsvCell(u?.unit_number ?? ""),
          escapeCsvCell(tenantName),
          escapeCsvCell(Number(p.amount ?? 0).toFixed(2)),
          escapeCsvCell(p.payment_method ?? ""),
          escapeCsvCell(p.status ?? ""),
        ].join(","));
      }
      downloadCsv(`rentflow-payments-${dateFrom}-to-${dateTo}.csv`, lines.join("\n"));
      toast.success("Payments CSV downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export payments");
    } finally {
      setExporting(null);
    }
  };

  const exportPayouts = async () => {
    if (!user) return;
    setExporting("payouts");
    try {
      const { data: payouts } = await supabase
        .from("payouts")
        .select("id, payout_date, amount, status")
        .eq("landlord_id", user.id)
        .gte("payout_date", dateFrom)
        .lte("payout_date", dateTo);
      const lines = ["Date,Amount,Status"];
      for (const p of payouts || []) {
        lines.push([escapeCsvCell(p.payout_date), escapeCsvCell(Number(p.amount ?? 0).toFixed(2)), escapeCsvCell(p.status ?? "")].join(","));
      }
      downloadCsv(`rentflow-payouts-${dateFrom}-to-${dateTo}.csv`, lines.join("\n"));
      toast.success("Payouts CSV downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export payouts");
    } finally {
      setExporting(null);
    }
  };

  const exportLedger = async () => {
    if (!user) return;
    setExporting("ledger");
    try {
      const { data, error } = await supabase.rpc("get_ledger_entries", {
        p_landlord_id: user.id,
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_property_id: selectedPropertyId === "all" ? null : selectedPropertyId,
        p_unit_id: selectedUnitId === "all" ? null : selectedUnitId,
        p_entry_types: null,
      });
      if (error) throw error;
      const rows = (data || []) as LedgerRow[];
      const lines = ["Date,Type,Debit,Credit,Category,Property,Unit,Tenant,Description"];
      for (const r of rows) {
        const debit = r.entry_type === "expense" || r.entry_type === "payout" ? Number(r.amount).toFixed(2) : "";
        const credit = r.entry_type === "income" ? Number(r.amount).toFixed(2) : "";
        lines.push([
          escapeCsvCell(r.entry_date),
          escapeCsvCell(r.entry_type),
          escapeCsvCell(debit),
          escapeCsvCell(credit),
          escapeCsvCell(r.category_name),
          escapeCsvCell(r.property_name),
          escapeCsvCell(r.unit_number),
          escapeCsvCell(r.tenant_name),
          escapeCsvCell(r.description),
        ].join(","));
      }
      downloadCsv(`rentflow-ledger-${dateFrom}-to-${dateTo}.csv`, lines.join("\n"));
      toast.success("Ledger CSV downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export ledger");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-2">CSV exports</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Export transactions, invoices (statements), payments, payouts, and ledger. Same filters (date range, property, unit) apply. Totals match the dashboard.
        </p>
      </div>
      <Card className="p-6">
        <p className="text-xs text-muted-foreground mb-4">Export includes the same data as the dashboard for the selected date range and filters.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={exportTransactions} disabled={exporting !== null}>
                  {exporting === "transactions" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                  Export transactions CSV
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ledger rows: income from payments, expenses, payouts. Same filters as dashboard.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="outline" onClick={exportInvoices} disabled={exporting !== null}>
            {exporting === "invoices" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Export invoices CSV
          </Button>
          <Button variant="outline" onClick={exportPayments} disabled={exporting !== null}>
            {exporting === "payments" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Export payments CSV
          </Button>
          <Button variant="outline" onClick={exportPayouts} disabled={exporting !== null}>
            {exporting === "payouts" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Export payouts CSV
          </Button>
          <Button variant="outline" onClick={exportLedger} disabled={exporting !== null}>
            {exporting === "ledger" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Export ledger CSV (debit/credit)
          </Button>
        </div>
      </Card>
      <Card className="p-6">
        <h3 className="font-semibold text-foreground mb-2">QuickBooks export</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Download a QuickBooks-compatible export (customers, invoices, payments, account mapping). See below for import instructions.
        </p>
        <QuickBooksExportButton
          user={user}
          dateFrom={dateFrom}
          dateTo={dateTo}
          selectedPropertyId={selectedPropertyId}
          selectedUnitId={selectedUnitId}
          exporting={exporting}
          setExporting={setExporting}
        />
      </Card>
    </div>
  );
}

interface ReconciliationIssue {
  type: string;
  entityId: string;
  entityLabel?: string;
  description: string;
  link?: string;
}

function ReconciliationTab({ user }: { user: { id: string } | null }) {
  const [issues, setIssues] = useState<ReconciliationIssue[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data: propData } = await supabase.from("properties").select("id").eq("landlord_id", user.id);
        const propertyIds = (propData || []).map((p) => p.id);
        const { data: unitsData } = await supabase.from("units").select("id").in("property_id", propertyIds);
        const unitIds = (unitsData || []).map((u) => u.id);
        const list: ReconciliationIssue[] = [];

        if (unitIds.length === 0) {
          if (!cancelled) setIssues([]);
          return;
        }

        const { data: payments } = await supabase
          .from("payments")
          .select("id, statement_id, unit_id, amount, status")
          .in("unit_id", unitIds);
        const { data: statements } = await supabase
          .from("statements")
          .select("id, unit_id, total_due, status")
          .in("unit_id", unitIds);
        const { data: paymentsByStmt } = await supabase
          .from("payments")
          .select("statement_id, statement_amount")
          .in("unit_id", unitIds)
          .in("status", ["completed", "paid"]);
        const paidByStmt = new Map<string, number>();
        (paymentsByStmt || []).forEach((p) => {
          if (p.statement_id) paidByStmt.set(p.statement_id, (paidByStmt.get(p.statement_id) || 0) + Number(p.statement_amount || 0));
        });

        for (const p of payments || []) {
          if (p.statement_id === null || p.statement_id === "") {
            list.push({
              type: "Payment without statement",
              entityId: p.id,
              description: `Payment ${p.id.slice(0, 8)}… has no statement linked. Amount: $${Number(p.amount || 0).toFixed(2)}`,
              link: "/admin/payments",
            });
          } else {
            const stmtExists = (statements || []).some((s) => s.id === p.statement_id);
            if (!stmtExists) {
              list.push({
                type: "Orphaned payment",
                entityId: p.id,
                description: `Payment ${p.id.slice(0, 8)}… references missing statement ${p.statement_id?.slice(0, 8)}…`,
                link: "/admin/payments",
              });
            }
          }
        }

        for (const s of statements || []) {
          if (s.status !== "paid" && (s.status === "unpaid" || s.status === "overdue" || s.status === "partial")) {
            const paid = paidByStmt.get(s.id) || 0;
            const due = Number(s.total_due || 0);
            if (paid < due && due > 0) {
              const short = (due - paid).toFixed(2);
              list.push({
                type: "Unpaid or short statement",
                entityId: s.id,
                description: `Statement ${s.id.slice(0, 8)}… owes $${short} (due: $${due.toFixed(2)}, paid: $${paid.toFixed(2)})`,
                link: "/admin/statements",
              });
            }
          }
        }

        const { data: expenses } = await supabase
          .from("expenses")
          .select("id, category_id, amount, expense_date")
          .eq("landlord_id", user.id);
        for (const e of expenses || []) {
          if (e.category_id === null || e.category_id === "") {
            list.push({
              type: "Expense missing category",
              entityId: e.id,
              description: `Expense ${e.id.slice(0, 8)}… ($${Number(e.amount || 0).toFixed(2)} on ${e.expense_date}) has no category`,
              link: "/admin/reports",
            });
          }
        }

        if (!cancelled) setIssues(list);
      } catch (e) {
        console.error("Reconciliation fetch error:", e);
        if (!cancelled) setIssues([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-2">Reconciliation &amp; data quality</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Mismatches, missing categories, and data issues. Fix these in the relevant pages (Payments, Statements, or Expenses) so reports stay accurate.
        </p>
      </div>
      <Card className="p-6">
        {loading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : issues.length === 0 ? (
          <p className="text-muted-foreground">No reconciliation issues found. Data looks consistent.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>Description</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((issue) => (
                <TableRow key={`${issue.type}-${issue.entityId}`}>
                  <TableCell className="font-medium">{issue.type}</TableCell>
                  <TableCell className="font-mono text-xs">{issue.entityId.slice(0, 8)}…</TableCell>
                  <TableCell>{issue.description}</TableCell>
                  <TableCell>
                    {issue.link && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={issue.link}>View</Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function QuickBooksExportButton({
  user,
  dateFrom,
  dateTo,
  selectedPropertyId,
  selectedUnitId,
  exporting,
  setExporting,
}: {
  user: { id: string } | null;
  dateFrom: string;
  dateTo: string;
  selectedPropertyId: string;
  selectedUnitId: string;
  exporting: string | null;
  setExporting: (v: string | null) => void;
}) {
  const [showHelp, setShowHelp] = useState(false);
  const handleQuickBooksExport = async () => {
    if (!user) return;
    setExporting("quickbooks");
    try {
      const { data, error } = await supabase.functions.invoke("export-quickbooks", {
        body: {
          start_date: dateFrom,
          end_date: dateTo,
          property_id: selectedPropertyId === "all" ? undefined : selectedPropertyId,
          unit_id: selectedUnitId === "all" ? undefined : selectedUnitId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const files = [
        { csv: data?.customers_csv, name: "quickbooks-customers.csv" },
        { csv: data?.invoices_csv, name: "quickbooks-invoices.csv" },
        { csv: data?.payments_csv, name: "quickbooks-payments.csv" },
        { csv: data?.account_mapping_csv, name: "quickbooks-account-mapping.csv" },
      ];
      for (const f of files) {
        if (f.csv) {
          const blob = new Blob([f.csv], { type: "text/csv;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = f.name;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
      toast.success("QuickBooks CSVs downloaded. See How to import for instructions.");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "QuickBooks export failed");
    } finally {
      setExporting(null);
    }
  };
  return (
    <div>
      <Button variant="outline" onClick={handleQuickBooksExport} disabled={exporting !== null}>
        {exporting === "quickbooks" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
        Export for QuickBooks
      </Button>
      <Button variant="ghost" size="sm" className="ml-2" onClick={() => setShowHelp(!showHelp)}>
        <HelpCircle className="h-4 w-4 mr-1" />
        How to import
      </Button>
      {showHelp && (
        <div className="mt-4 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          In QuickBooks: Go to Settings (gear) → Import data → select the CSV(s). Map columns if prompted. Use Customers for tenants, Invoices for statements, Payments for rent payments.
        </div>
      )}
    </div>
  );
}

function TaxReportContent({
  grossIncome,
  expensesByCategory,
  totalExpenses,
  netIncome,
  taxYear,
  formatCurrency: fmt,
}: {
  grossIncome: number;
  expensesByCategory: { categoryName: string; amount: number }[];
  totalExpenses: number;
  netIncome: number;
  taxYear: string;
  formatCurrency: (n: number) => string;
}) {
  const generatedAt = format(new Date(), "PPpp");
  return (
    <Card className="p-6 print:shadow-none">
      <p className="text-xs text-muted-foreground mb-4">
        Report generated at {generatedAt}. For period: calendar year {taxYear}.
      </p>
      <section className="mb-6">
        <h3 className="font-semibold text-foreground mb-2">Gross rental income</h3>
        <p className="text-2xl font-semibold text-foreground">{fmt(grossIncome)}</p>
      </section>
      <section className="mb-6">
        <h3 className="font-semibold text-foreground mb-2">Allowable expenses</h3>
        {expensesByCategory.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expensesByCategory.map((row) => (
                <TableRow key={row.categoryName}>
                  <TableCell>{row.categoryName}</TableCell>
                  <TableCell className="text-right">{fmt(row.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Total expenses</TableCell>
                <TableCell className="text-right font-semibold">{fmt(totalExpenses)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        ) : (
          <p className="text-muted-foreground">No expenses recorded for this year.</p>
        )}
      </section>
      <section>
        <h3 className="font-semibold text-foreground mb-2">Net income</h3>
        <p className="text-2xl font-semibold text-foreground">{fmt(netIncome)}</p>
      </section>
    </Card>
  );
}

interface LedgerRow {
  entry_type: string;
  entry_date: string;
  amount: number;
  category_name: string | null;
  property_name: string | null;
  unit_number: string | null;
  tenant_name: string | null;
  description: string | null;
  reference_type: string;
  reference_id?: string;
}

interface DashboardMetrics {
  incomeTotal: number;
  expenseTotal: number;
  payoutTotal: number;
  noi: number;
  cashflow: number;
  outstandingTotal: number;
  failedPaymentsCount: number;
  failedPaymentsAmount: number;
  ledgerRows: LedgerRow[];
  breakdownByProperty: { propertyName: string; income: number; expense: number; unitCount: number }[];
}

export default function AdminReports() {
  const { user } = useAuth();
  const [preset, setPreset] = useState<string>(() => {
    return localStorage.getItem(REPORT_PRESET_KEY) || "this_year";
  });
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const stored = localStorage.getItem(REPORT_FROM_KEY);
    if (stored) return stored;
    const defaultPreset = localStorage.getItem(REPORT_PRESET_KEY) || "this_year";
    const { from } = getPresetRange(defaultPreset);
    return formatDateForInput(from);
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    const stored = localStorage.getItem(REPORT_TO_KEY);
    if (stored) return stored;
    const defaultPreset = localStorage.getItem(REPORT_PRESET_KEY) || "this_year";
    const { to } = getPresetRange(defaultPreset);
    return formatDateForInput(to);
  });
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; unit_number: string; property_id: string }[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");
  const [selectedUnitId, setSelectedUnitId] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [taxYear, setTaxYear] = useState<string>(() => String(new Date().getFullYear()));
  const [taxReport, setTaxReport] = useState<{
    ledgerRows: LedgerRow[];
    grossIncome: number;
    expensesByCategory: { categoryName: string; amount: number }[];
    totalExpenses: number;
    netIncome: number;
    loading: boolean;
  }>({ ledgerRows: [], grossIncome: 0, expensesByCategory: [], totalExpenses: 0, netIncome: 0, loading: false });
  const [dashboard, setDashboard] = useState<DashboardMetrics>({
    incomeTotal: 0,
    expenseTotal: 0,
    payoutTotal: 0,
    noi: 0,
    cashflow: 0,
    outstandingTotal: 0,
    failedPaymentsCount: 0,
    failedPaymentsAmount: 0,
    ledgerRows: [],
    breakdownByProperty: [],
  });

  const applyPreset = useCallback((newPreset: string) => {
    setPreset(newPreset);
    const { from, to } = getPresetRange(newPreset);
    const fromStr = formatDateForInput(from);
    const toStr = formatDateForInput(to);
    setDateFrom(fromStr);
    setDateTo(toStr);
    localStorage.setItem(REPORT_PRESET_KEY, newPreset);
    localStorage.setItem(REPORT_FROM_KEY, fromStr);
    localStorage.setItem(REPORT_TO_KEY, toStr);
  }, []);

  useEffect(() => {
    if (preset !== "custom") {
      const { from, to } = getPresetRange(preset);
      setDateFrom(formatDateForInput(from));
      setDateTo(formatDateForInput(to));
    }
  }, [preset]);

  useEffect(() => {
    if (preset === "custom") {
      localStorage.setItem(REPORT_FROM_KEY, dateFrom);
      localStorage.setItem(REPORT_TO_KEY, dateTo);
    }
  }, [preset, dateFrom, dateTo]);

  const fetchProperties = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name")
        .eq("landlord_id", user.id)
        .order("name", { ascending: true });
      if (error) throw error;
      setProperties(data || []);
    } catch (e) {
      console.error("Error fetching properties:", e);
    }
  }, [user]);

  const fetchUnits = useCallback(async () => {
    if (!user) return;
    try {
      const { data: propData } = await supabase
        .from("properties")
        .select("id")
        .eq("landlord_id", user.id);
      if (!propData?.length) {
        setUnits([]);
        return;
      }
      const propertyIds = propData.map((p) => p.id);
      const { data, error } = await supabase
        .from("units")
        .select("id, unit_number, property_id")
        .in("property_id", propertyIds)
        .order("unit_number", { ascending: true });
      if (error) throw error;
      setUnits(data || []);
    } catch (e) {
      console.error("Error fetching units:", e);
    }
  }, [user]);

  useEffect(() => {
    fetchProperties();
    fetchUnits();
  }, [fetchProperties, fetchUnits]);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const pPropertyId = selectedPropertyId === "all" ? null : selectedPropertyId;
      const pUnitId = selectedUnitId === "all" ? null : selectedUnitId;

      const { data: ledgerData, error: ledgerError } = await supabase.rpc("get_ledger_entries", {
        p_landlord_id: user.id,
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_property_id: pPropertyId,
        p_unit_id: pUnitId,
        p_entry_types: null,
      });
      if (ledgerError) throw ledgerError;
      const rows = (ledgerData || []) as LedgerRow[];

      const incomeTotal = rows
        .filter((r) => r.entry_type === "income")
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const expenseTotal = rows
        .filter((r) => r.entry_type === "expense")
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const payoutTotal = rows
        .filter((r) => r.entry_type === "payout")
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const noi = Math.round((incomeTotal - expenseTotal) * 100) / 100;
      const cashflow = Math.round((incomeTotal - expenseTotal - payoutTotal) * 100) / 100;

      const breakdownByProperty: { propertyName: string; income: number; expense: number; unitCount: number }[] = [];
      const byProp = new Map<string, { income: number; expense: number; units: Set<string> }>();
      for (const r of rows) {
        const name = r.property_name || "Other";
        if (!byProp.has(name)) byProp.set(name, { income: 0, expense: 0, units: new Set() });
        const rec = byProp.get(name)!;
        if (r.entry_type === "income") rec.income += Number(r.amount || 0);
        if (r.entry_type === "expense") rec.expense += Number(r.amount || 0);
        if (r.unit_number) rec.units.add(r.unit_number);
      }
      byProp.forEach((v, name) => {
        breakdownByProperty.push({
          propertyName: name,
          income: Math.round(v.income * 100) / 100,
          expense: Math.round(v.expense * 100) / 100,
          unitCount: v.units.size,
        });
      });

      const { data: propData } = await supabase.from("properties").select("id").eq("landlord_id", user.id);
      const propertyIds = (propData || []).map((p) => p.id);
      if (propertyIds.length === 0) {
        setDashboard({
          incomeTotal,
          expenseTotal,
          payoutTotal,
          noi,
          cashflow,
          outstandingTotal: 0,
          failedPaymentsCount: 0,
          failedPaymentsAmount: 0,
          ledgerRows: rows,
          breakdownByProperty,
        });
        return;
      }
      const { data: unitsData } = await supabase
        .from("units")
        .select("id, due_day, first_month_paid")
        .in("property_id", propertyIds);
      const unitIds = (unitsData || []).map((u) => u.id);
      if (unitIds.length === 0) {
        setDashboard({
          incomeTotal,
          expenseTotal,
          payoutTotal,
          noi,
          cashflow,
          outstandingTotal: 0,
          failedPaymentsCount: 0,
          failedPaymentsAmount: 0,
          ledgerRows: rows,
          breakdownByProperty,
        });
        return;
      }

      const currentMonth = format(new Date(), "MM/yyyy");
      const { data: statementsData } = await supabase
        .from("statements")
        .select("id, unit_id, total_due, period_month")
        .in("unit_id", unitIds)
        .in("status", ["unpaid", "overdue", "partial"]);
      const statementIds = (statementsData || []).map((s) => s.id);
      const { data: paymentsData } = await supabase
        .from("payments")
        .select("statement_id, statement_amount")
        .in("statement_id", statementIds.length ? statementIds : ["00000000-0000-0000-0000-000000000000"])
        .in("status", ["completed", "paid"]);
      const paidByStatement = new Map<string, number>();
      (paymentsData || []).forEach((p) => {
        const sid = p.statement_id;
        if (!sid) return;
        paidByStatement.set(sid, (paidByStatement.get(sid) || 0) + Number(p.statement_amount || 0));
      });
      let outstandingTotal = 0;
      (statementsData || []).forEach((s) => {
        const paid = paidByStatement.get(s.id) || 0;
        const due = Number(s.total_due || 0);
        if (due > paid) outstandingTotal += due - paid;
      });
      outstandingTotal = Math.round(outstandingTotal * 100) / 100;

      const { data: failedData } = await supabase
        .from("payments")
        .select("id, amount")
        .in("unit_id", unitIds)
        .in("status", ["failed", "pending"]);
      const failedPaymentsCount = failedData?.length || 0;
      const failedPaymentsAmount = (failedData || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

      setDashboard({
        incomeTotal: Math.round(incomeTotal * 100) / 100,
        expenseTotal: Math.round(expenseTotal * 100) / 100,
        payoutTotal: Math.round(payoutTotal * 100) / 100,
        noi,
        cashflow,
        outstandingTotal,
        failedPaymentsCount,
        failedPaymentsAmount: Math.round(failedPaymentsAmount * 100) / 100,
        ledgerRows: rows,
        breakdownByProperty,
      });
    } catch (e) {
      console.error("Error fetching dashboard:", e);
    } finally {
      setLoading(false);
    }
  }, [user, dateFrom, dateTo, selectedPropertyId, selectedUnitId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const fetchTaxReport = useCallback(async () => {
    if (!user) return;
    setTaxReport((prev) => ({ ...prev, loading: true }));
    try {
      const from = `${taxYear}-01-01`;
      const to = `${taxYear}-12-31`;
      const { data, error } = await supabase.rpc("get_ledger_entries", {
        p_landlord_id: user.id,
        p_date_from: from,
        p_date_to: to,
        p_property_id: null,
        p_unit_id: null,
        p_entry_types: null,
      });
      if (error) throw error;
      const rows = (data || []) as LedgerRow[];
      const grossIncome = rows
        .filter((r) => r.entry_type === "income")
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const expenseRows = rows.filter((r) => r.entry_type === "expense");
      const totalExpenses = expenseRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      const byCategory = new Map<string, number>();
      expenseRows.forEach((r) => {
        const name = r.category_name || "Uncategorized";
        byCategory.set(name, (byCategory.get(name) || 0) + Number(r.amount || 0));
      });
      const expensesByCategory = Array.from(byCategory.entries()).map(([categoryName, amount]) => ({
        categoryName,
        amount: Math.round(amount * 100) / 100,
      }));
      const netIncome = Math.round((grossIncome - totalExpenses) * 100) / 100;
      setTaxReport({
        ledgerRows: rows,
        grossIncome: Math.round(grossIncome * 100) / 100,
        expensesByCategory,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        netIncome,
        loading: false,
      });
    } catch (e) {
      console.error("Error fetching tax report:", e);
      setTaxReport((prev) => ({ ...prev, loading: false }));
    }
  }, [user, taxYear]);

  useEffect(() => {
    fetchTaxReport();
  }, [fetchTaxReport]);

  const filterSummary = (
    <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-muted/50 rounded-lg border border-border">
      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">Date preset</Label>
        <Select value={preset} onValueChange={applyPreset}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">This month</SelectItem>
            <SelectItem value="last_month">Last month</SelectItem>
            <SelectItem value="this_quarter">This quarter</SelectItem>
            <SelectItem value="this_year">This year</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {preset === "custom" && (
        <>
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[160px]"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[160px]"
            />
          </div>
        </>
      )}
      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">Property</Label>
        <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All properties</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label className="text-xs text-muted-foreground">Unit</Label>
        <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All units" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All units</SelectItem>
            {units
              .filter((u) => selectedPropertyId === "all" || u.property_id === selectedPropertyId)
              .map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.unit_number}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="p-6 md:p-8">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Reports</h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground cursor-help inline-flex items-center">
                    <HelpCircle className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  Reports use the same date range and filters everywhere so totals match the dashboard, exports, and statements. See docs/REPORTS.md for details.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-muted-foreground mt-1">
            Income, expenses, tax summaries, statements, and exports for your records and accountants.
          </p>
        </div>

        {filterSummary}

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 gap-2 h-auto flex-wrap">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="tax" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Tax reports
            </TabsTrigger>
            <TabsTrigger value="statements" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Statements
            </TabsTrigger>
            <TabsTrigger value="exports" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Exports
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Reconciliation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Income &amp; expense summary</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Gross income, allowable expenses, NOI, cashflow, outstanding receivables, and failed payments for the selected period.
              </p>
            </div>
            {loading ? (
              <div className="text-muted-foreground">Loading…</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-xs font-medium">Gross income</span>
                    </div>
                    <p className="text-xl font-semibold text-foreground">{formatCurrency(dashboard.incomeTotal)}</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrendingDown className="h-4 w-4" />
                      <span className="text-xs font-medium">Allowable expenses</span>
                    </div>
                    <p className="text-xl font-semibold text-foreground">{formatCurrency(dashboard.expenseTotal)}</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Calculator className="h-4 w-4" />
                      <span className="text-xs font-medium">Net operating income</span>
                    </div>
                    <p className="text-xl font-semibold text-foreground">{formatCurrency(dashboard.noi)}</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-xs font-medium">Cashflow</span>
                    </div>
                    <p className="text-xl font-semibold text-foreground">{formatCurrency(dashboard.cashflow)}</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <CreditCard className="h-4 w-4" />
                      <span className="text-xs font-medium">Outstanding receivables</span>
                    </div>
                    <p className="text-xl font-semibold text-foreground">{formatCurrency(dashboard.outstandingTotal)}</p>
                  </Card>
                  <Card className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <XCircle className="h-4 w-4" />
                      <span className="text-xs font-medium">Failed / pending</span>
                    </div>
                    <p className="text-xl font-semibold text-foreground">{formatCurrency(dashboard.failedPaymentsAmount)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{dashboard.failedPaymentsCount} payment(s)</p>
                  </Card>
                </div>
                {dashboard.breakdownByProperty.length > 0 && (
                  <Card className="p-6">
                    <h3 className="font-semibold text-foreground mb-4">Breakdown by property</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Property</TableHead>
                          <TableHead className="text-right">Income</TableHead>
                          <TableHead className="text-right">Expenses</TableHead>
                          <TableHead className="text-right">Units</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dashboard.breakdownByProperty.map((row) => (
                          <TableRow key={row.propertyName}>
                            <TableCell className="font-medium">{row.propertyName}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.income)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.expense)}</TableCell>
                            <TableCell className="text-right">{row.unitCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )}
                {dashboard.ledgerRows.length > 0 && (
                  <Card className="p-6">
                    <h3 className="font-semibold text-foreground mb-4">Ledger preview (first 50 rows)</h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Property</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead>Tenant</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dashboard.ledgerRows.slice(0, 50).map((r, i) => (
                            <TableRow key={r.reference_id ?? `row-${i}`}>
                              <TableCell>{r.entry_date}</TableCell>
                              <TableCell>{r.entry_type}</TableCell>
                              <TableCell>{r.category_name ?? "—"}</TableCell>
                              <TableCell>{r.property_name ?? "—"}</TableCell>
                              <TableCell>{r.unit_number ?? "—"}</TableCell>
                              <TableCell>{r.tenant_name ?? "—"}</TableCell>
                              <TableCell className="text-right">
                                {r.entry_type === "expense" || r.entry_type === "payout"
                                  ? `(${formatCurrency(r.amount)})`
                                  : formatCurrency(r.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="tax" className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Tax-ready reports</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Annual summary and category totals for tax filing. Use the same date range above or select a year below.
              </p>
              <div className="flex items-center gap-4 mb-4">
                <Label className="text-sm">Calendar year</Label>
                <Select value={taxYear} onValueChange={setTaxYear}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {taxReport.loading ? (
              <div className="text-muted-foreground">Loading tax report…</div>
            ) : (
              <TaxReportContent
                grossIncome={taxReport.grossIncome}
                expensesByCategory={taxReport.expensesByCategory}
                totalExpenses={taxReport.totalExpenses}
                netIncome={taxReport.netIncome}
                taxYear={taxYear}
                formatCurrency={formatCurrency}
              />
            )}
          </TabsContent>

          <TabsContent value="statements" className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Statements</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Owner statement, P&amp;L, and tenant statement PDFs. Use the date range above or set a custom period below.
              </p>
            </div>
            <StatementsTab
              dateFrom={dateFrom}
              dateTo={dateTo}
              selectedPropertyId={selectedPropertyId}
              properties={properties}
              formatCurrency={formatCurrency}
            />
          </TabsContent>

          <TabsContent value="exports" className="space-y-6">
            <ExportsTab
              user={user}
              dateFrom={dateFrom}
              dateTo={dateTo}
              selectedPropertyId={selectedPropertyId}
              selectedUnitId={selectedUnitId}
              formatCurrency={formatCurrency}
            />
          </TabsContent>

          <TabsContent value="reconciliation" className="space-y-6">
            <ReconciliationTab user={user} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
