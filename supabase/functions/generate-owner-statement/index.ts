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

    if (propertyIds.length === 0) {
      const result = {
        start_date: startDate,
        end_date: endDate,
        income_total: 0,
        expense_total: 0,
        payout_total: 0,
        net_cashflow: 0,
        generated_at: new Date().toISOString(),
      };
      if (asPdf) {
        const pdf = await buildOwnerStatementPdf(result);
        return new Response(pdf, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="owner-statement-${startDate}-to-${endDate}.pdf"`,
          },
        });
      }
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: units } = await supabase
      .from("units")
      .select("id")
      .in("property_id", propertyIds);
    const unitIds = (units || []).map((u) => u.id);

    let incomeTotal = 0;
    if (unitIds.length > 0) {
      const startTs = `${startDate}T00:00:00.000Z`;
      const endTs = `${endDate}T23:59:59.999Z`;
      // Payments with paid_at in range
      const { data: paymentsWithPaidAt } = await supabase
        .from("payments")
        .select("statement_amount, amount, fee_amount")
        .in("unit_id", unitIds)
        .in("status", ["completed", "paid"])
        .not("paid_at", "is", null)
        .gte("paid_at", startTs)
        .lte("paid_at", endTs);
      // Payments with null paid_at: use created_at for date (e.g. before webhook set paid_at)
      const { data: paymentsNullPaidAt } = await supabase
        .from("payments")
        .select("statement_amount, amount, fee_amount, created_at")
        .in("unit_id", unitIds)
        .in("status", ["completed", "paid"])
        .is("paid_at", null)
        .gte("created_at", startTs)
        .lte("created_at", endTs);
      const allPayments = [...(paymentsWithPaidAt || []), ...(paymentsNullPaidAt || [])];
      incomeTotal = allPayments.reduce(
        (sum, p) => sum + (Number(p.statement_amount ?? p.amount - (p.fee_amount ?? 0)) || 0),
        0
      );
    }

    const { data: expenses } = await supabase
      .from("expenses")
      .select("amount")
      .eq("landlord_id", user.id)
      .gte("expense_date", startDate)
      .lte("expense_date", endDate)
      .in("property_id", propertyIds);
    const expenseTotal = (expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const { data: payouts } = await supabase
      .from("payouts")
      .select("amount")
      .eq("landlord_id", user.id)
      .gte("payout_date", startDate)
      .lte("payout_date", endDate);
    const payoutTotal = (payouts || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const netCashflow = Math.round((incomeTotal - expenseTotal - payoutTotal) * 100) / 100;
    incomeTotal = Math.round(incomeTotal * 100) / 100;
    const expenseTotalR = Math.round(expenseTotal * 100) / 100;
    const payoutTotalR = Math.round(payoutTotal * 100) / 100;

    const result = {
      start_date: startDate,
      end_date: endDate,
      income_total: incomeTotal,
      expense_total: expenseTotalR,
      payout_total: payoutTotalR,
      net_cashflow: netCashflow,
      generated_at: new Date().toISOString(),
    };

    if (asPdf) {
      const pdf = await buildOwnerStatementPdf(result);
      return new Response(pdf, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="owner-statement-${startDate}-to-${endDate}.pdf"`,
        },
      });
    }
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-owner-statement error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function buildOwnerStatementPdf(result: {
  start_date: string;
  end_date: string;
  income_total: number;
  expense_total: number;
  payout_total: number;
  net_cashflow: number;
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
  page.drawText("Owner Statement", { x: width - 160, y, size: 18, font: helveticaBold, color: text });
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

  const line = (label: string, value: string) => {
    page.drawText(label, { x: 50, y, size: 11, font: helvetica, color: text });
    page.drawText(value, { x: width - 120, y, size: 11, font: helvetica, color: text });
    y -= 20;
  };
  line("Gross income", formatCurrency(result.income_total));
  line("Allowable expenses", `(${formatCurrency(result.expense_total)})`);
  line("Payouts", `(${formatCurrency(result.payout_total)})`);
  y -= 8;
  page.drawText("Net cashflow", { x: 50, y, size: 12, font: helveticaBold, color: text });
  page.drawText(formatCurrency(result.net_cashflow), {
    x: width - 120,
    y,
    size: 12,
    font: helveticaBold,
    color: text,
  });

  return doc.save();
}
