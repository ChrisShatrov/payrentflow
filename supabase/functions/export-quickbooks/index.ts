import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const startDate = body.start_date as string;
    const endDate = body.end_date as string;
    const propertyId = body.property_id as string | null | undefined;
    const unitId = body.unit_id as string | null | undefined;

    if (!startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: "start_date and end_date are required (YYYY-MM-DD)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let propertyIds: string[];
    if (propertyId) {
      const { data: p } = await supabase
        .from("properties")
        .select("id")
        .eq("id", propertyId)
        .eq("landlord_id", user.id)
        .single();
      if (!p) {
        return new Response(JSON.stringify({ error: "Property not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      propertyIds = [p.id];
    } else {
      const { data: props } = await supabase
        .from("properties")
        .select("id")
        .eq("landlord_id", user.id);
      propertyIds = (props || []).map((p) => p.id);
    }

    const { data: unitsData } = await supabase
      .from("units")
      .select("id, unit_number, property_id, tenant_id")
      .in("property_id", propertyIds.length ? propertyIds : ["00000000-0000-0000-0000-000000000000"]);
    let units = unitsData || [];
    if (unitId) units = units.filter((u) => u.id === unitId);
    const unitIds = units.map((u) => u.id);
    const tenantIds = [...new Set(units.map((u) => u.tenant_id).filter(Boolean))] as string[];

    const { data: profiles } = tenantIds.length
      ? await supabase.from("profiles").select("id, full_name, email").in("id", tenantIds)
      : { data: [] };
    const tenantMap = new Map((profiles || []).map((p) => [p.id, p]));

    const customersRows = ["Customer ID,Customer Name,Email"];
    for (const tid of tenantIds) {
      const t = tenantMap.get(tid);
      const id = tid;
      const name = t?.full_name?.trim() || t?.email || id;
      const email = t?.email || "";
      customersRows.push([escapeCsv(id), escapeCsv(name), escapeCsv(email)].join(","));
    }
    const customers_csv = customersRows.join("\n");

    const [fromY, fromM] = startDate.split("-").map(Number);
    const [toY, toM] = endDate.split("-").map(Number);
    const { data: statements } = await supabase
      .from("statements")
      .select("id, unit_id, period_month, total_due")
      .in("unit_id", unitIds.length ? unitIds : ["00000000-0000-0000-0000-000000000000"]);
    const unitMap = new Map(units.map((u) => [u.id, u]));
    const invoicesRows = ["Invoice Number,Customer ID,Date,Amount,Description"];
    for (const s of statements || []) {
      const [month, year] = (s.period_month || "").split("/").map(Number);
      if (year < fromY || (year === fromY && month < fromM)) continue;
      if (year > toY || (year === toY && month > toM)) continue;
      const unit = unitMap.get(s.unit_id);
      const customerId = unit?.tenant_id ?? "";
      if (!customerId) continue;
      const lastDay = new Date(year, month, 0).getDate();
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const amount = Number(s.total_due ?? 0).toFixed(2);
      invoicesRows.push([
        escapeCsv(s.id),
        escapeCsv(customerId),
        escapeCsv(dateStr),
        escapeCsv(amount),
        escapeCsv(`Rent ${s.period_month}`),
      ].join(","));
    }
    const invoices_csv = invoicesRows.join("\n");

    const { data: payments } = await supabase
      .from("payments")
      .select("id, statement_id, unit_id, amount, paid_at")
      .in("unit_id", unitIds)
      .in("status", ["completed", "paid"])
      .gte("paid_at", `${startDate}T00:00:00.000Z`)
      .lte("paid_at", `${endDate}T23:59:59.999Z`);
    const paymentsRows = ["Payment ID,Invoice Number,Customer ID,Amount,Date"];
    for (const p of payments || []) {
      const unit = unitMap.get(p.unit_id);
      const customerId = unit?.tenant_id ?? "";
      const dateStr = p.paid_at ? p.paid_at.slice(0, 10) : "";
      paymentsRows.push([
        escapeCsv(p.id),
        escapeCsv(p.statement_id ?? ""),
        escapeCsv(customerId),
        escapeCsv(Number(p.amount ?? 0).toFixed(2)),
        escapeCsv(dateStr),
      ].join(","));
    }
    const payments_csv = paymentsRows.join("\n");

    const accountMappingRows = ["Category Name,QuickBooks Account Name"];
    const defaultMapping: [string, string][] = [
      ["Rent", "Rental Income"],
      ["Late fees", "Other Income"],
      ["Other income", "Other Income"],
      ["Repairs & maintenance", "Repairs and Maintenance"],
      ["Utilities", "Utilities"],
      ["Insurance", "Insurance"],
      ["Property tax", "Property Tax"],
      ["Management", "Management Fee"],
      ["Other", "Other Expenses"],
    ];
    defaultMapping.forEach(([cat, qb]) => accountMappingRows.push([escapeCsv(cat), escapeCsv(qb)].join(",")));
    const account_mapping_csv = accountMappingRows.join("\n");

    return new Response(
      JSON.stringify({
        customers_csv,
        invoices_csv,
        payments_csv,
        account_mapping_csv,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("export-quickbooks error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
