import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

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
    const asPdf = (body.format === "pdf" || new URL(req.url).searchParams.get("format") === "pdf");

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

    const unitIds: string[] = [];
    if (propertyIds.length > 0) {
      const { data: units } = await supabase
        .from("units")
        .select("id")
        .in("property_id", propertyIds);
      unitIds.push(...(units || []).map((u) => u.id));
    }

    let incomeTotal = 0;
    const incomeByCategory: Record<string, number> = { Rent: 0 };
    if (unitIds.length > 0) {
      const startTs = `${startDate}T00:00:00.000Z`;
      const endTs = `${endDate}T23:59:59.999Z`;
      const { data: paymentsWithPaidAt } = await supabase
        .from("payments")
        .select("statement_amount, amount, fee_amount")
        .in("unit_id", unitIds)
        .in("status", ["completed", "paid"])
        .not("paid_at", "is", null)
        .gte("paid_at", startTs)
        .lte("paid_at", endTs);
      const { data: paymentsNullPaidAt } = await supabase
        .from("payments")
        .select("statement_amount, amount, fee_amount")
        .in("unit_id", unitIds)
        .in("status", ["completed", "paid"])
        .is("paid_at", null)
        .gte("created_at", startTs)
        .lte("created_at", endTs);
      const allPayments = [...(paymentsWithPaidAt || []), ...(paymentsNullPaidAt || [])];
      for (const p of allPayments) {
        const amt = Number(p.statement_amount ?? p.amount - (p.fee_amount ?? 0)) || 0;
        incomeTotal += amt;
        incomeByCategory["Rent"] = (incomeByCategory["Rent"] || 0) + amt;
      }
    }
    incomeTotal = Math.round(incomeTotal * 100) / 100;
    incomeByCategory["Rent"] = Math.round((incomeByCategory["Rent"] || 0) * 100) / 100;

    let expenseQuery = supabase
      .from("expenses")
      .select("amount, category_id, categories(name)")
      .eq("landlord_id", user.id)
      .gte("expense_date", startDate)
      .lte("expense_date", endDate);
    if (propertyIds.length > 0) {
      expenseQuery = expenseQuery.in("property_id", propertyIds);
    }
    const { data: expenses } = await expenseQuery;

    const expenseByCategory: Record<string, number> = {};
    let expenseTotal = 0;
    for (const e of expenses || []) {
      const amt = Number(e.amount || 0);
      const name = (e.categories as { name?: string } | null)?.name ?? "Uncategorized";
      expenseByCategory[name] = (expenseByCategory[name] || 0) + amt;
      expenseTotal += amt;
    }
    expenseTotal = Math.round(expenseTotal * 100) / 100;
    const expenseEntries = Object.entries(expenseByCategory).map(([name, amount]) => ({
      category_name: name,
      amount: Math.round(amount * 100) / 100,
    }));

    const netIncome = Math.round((incomeTotal - expenseTotal) * 100) / 100;
    const incomeEntries = Object.entries(incomeByCategory).map(([name, amount]) => ({
      category_name: name,
      amount,
    }));

    const result = {
      start_date: startDate,
      end_date: endDate,
      gross_income: incomeTotal,
      income_by_category: incomeEntries,
      total_expenses: expenseTotal,
      expenses_by_category: expenseEntries,
      net_income: netIncome,
      generated_at: new Date().toISOString(),
    };

    if (asPdf) {
      const pdf = await buildPnlPdf(result);
      return new Response(pdf, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="pnl-statement-${startDate}-to-${endDate}.pdf"`,
        },
      });
    }
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-pnl-statement error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function buildPnlPdf(result: {
  start_date: string;
  end_date: string;
  gross_income: number;
  income_by_category: { category_name: string; amount: number }[];
  total_expenses: number;
  expenses_by_category: { category_name: string; amount: number }[];
  net_income: number;
  generated_at: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const { width, height } = page.getSize();
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const primary = rgb(0.39, 0.4, 0.95);
  const text = rgb(0.12, 0.12, 0.12);
  const gray = rgb(0.45, 0.45, 0.45);

  let y = height - 50;
  page.drawText("RentFlow", { x: 50, y, size: 24, font: helveticaBold, color: primary });
  page.drawText("Profit & Loss Statement", { x: width - 200, y, size: 18, font: helveticaBold, color: text });
  y -= 20;
  page.drawText(`Period: ${result.start_date} to ${result.end_date}`, {
    x: 50,
    y,
    size: 11,
    font: helvetica,
    color: gray,
  });
  y -= 14;
  page.drawText(`Generated: ${new Date(result.generated_at).toLocaleString("en-US")}`, {
    x: 50,
    y,
    size: 10,
    font: helvetica,
    color: gray,
  });
  y -= 32;

  page.drawText("Gross rental income", { x: 50, y, size: 12, font: helveticaBold, color: text });
  y -= 18;
  for (const row of result.income_by_category) {
    page.drawText(row.category_name, { x: 60, y, size: 11, font: helvetica, color: text });
    page.drawText(formatCurrency(row.amount), { x: width - 100, y, size: 11, font: helvetica, color: text });
    y -= 16;
  }
  page.drawText("Total income", { x: 50, y, size: 11, font: helveticaBold, color: text });
  page.drawText(formatCurrency(result.gross_income), { x: width - 100, y, size: 11, font: helveticaBold, color: text });
  y -= 24;

  page.drawText("Allowable expenses", { x: 50, y, size: 12, font: helveticaBold, color: text });
  y -= 18;
  for (const row of result.expenses_by_category) {
    page.drawText(row.category_name, { x: 60, y, size: 11, font: helvetica, color: text });
    page.drawText(`(${formatCurrency(row.amount)})`, { x: width - 100, y, size: 11, font: helvetica, color: text });
    y -= 16;
  }
  page.drawText("Total expenses", { x: 50, y, size: 11, font: helveticaBold, color: text });
  page.drawText(`(${formatCurrency(result.total_expenses)})`, {
    x: width - 100,
    y,
    size: 11,
    font: helveticaBold,
    color: text,
  });
  y -= 24;

  page.drawText("Net income", { x: 50, y, size: 12, font: helveticaBold, color: text });
  page.drawText(formatCurrency(result.net_income), { x: width - 100, y, size: 12, font: helveticaBold, color: text });

  return doc.save();
}
