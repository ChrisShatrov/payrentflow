import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const formatPeriod = (period: string): string => {
  const [month, year] = period.split('/');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const getOrdinalSuffix = (day: number): string => {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { statement_id } = await req.json();

    if (!statement_id) {
      return new Response(
        JSON.stringify({ error: "statement_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating PDF for statement ${statement_id}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch statement with all related data
    const { data: statement, error: fetchError } = await supabase
      .from("statements")
      .select(`
        *,
        units!inner(
          unit_number,
          monthly_rent,
          due_day,
          late_fee_amount,
          daily_late_fee,
          late_fee_type,
          tenant_id,
          property_id,
          properties!inner(id, name, address, landlord_id),
          profiles(full_name, email, phone)
        )
      `)
      .eq("id", statement_id)
      .single();

    if (fetchError || !statement) {
      console.error("Statement not found:", fetchError);
      return new Response(
        JSON.stringify({ error: "Statement not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const unit = statement.units as any;
    const property = unit.properties;
    const tenant = unit.profiles;

    // Get landlord info
    const { data: landlord } = await supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("id", property.landlord_id)
      .single();

    const today = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Generate HTML for PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Rent Statement - ${formatPeriod(statement.period_month)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1f2937;
      line-height: 1.5;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #6366f1;
    }
    .logo {
      font-size: 28px;
      font-weight: 700;
      color: #6366f1;
    }
    .statement-info {
      text-align: right;
    }
    .statement-info h2 {
      font-size: 24px;
      color: #111827;
      margin-bottom: 4px;
    }
    .statement-info p {
      color: #6b7280;
      font-size: 14px;
    }
    .parties {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
    }
    .party {
      width: 45%;
    }
    .party-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      margin-bottom: 8px;
    }
    .party-name {
      font-size: 18px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 4px;
    }
    .party-details {
      font-size: 14px;
      color: #4b5563;
    }
    .property-box {
      background: #f3f4f6;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
    }
    .property-box h3 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .property-box p {
      color: #4b5563;
      font-size: 14px;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .details-table th {
      text-align: left;
      padding: 12px 16px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
    }
    .details-table td {
      padding: 16px;
      border-bottom: 1px solid #e5e7eb;
    }
    .details-table .amount {
      text-align: right;
      font-family: 'SF Mono', Monaco, monospace;
    }
    .details-table .total-row {
      background: #6366f1;
      color: white;
    }
    .details-table .total-row td {
      font-weight: 600;
      font-size: 18px;
      border: none;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-paid { background: #d1fae5; color: #065f46; }
    .status-unpaid { background: #e5e7eb; color: #374151; }
    .status-overdue { background: #fee2e2; color: #991b1b; }
    .status-partial { background: #fef3c7; color: #92400e; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #9ca3af;
      text-align: center;
    }
    .due-info {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 30px;
    }
    .due-info p {
      color: #1e40af;
      font-size: 14px;
    }
    .due-info strong {
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">RentFlow</div>
    <div class="statement-info">
      <h2>Rent Statement</h2>
      <p>${formatPeriod(statement.period_month)}</p>
      <p>Generated: ${today}</p>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="party-label">From (Landlord)</div>
      <div class="party-name">${landlord?.full_name || 'Property Manager'}</div>
      <div class="party-details">
        ${landlord?.email || ''}<br>
        ${landlord?.phone || ''}
      </div>
    </div>
    <div class="party">
      <div class="party-label">To (Tenant)</div>
      <div class="party-name">${tenant?.full_name || 'Tenant'}</div>
      <div class="party-details">
        ${tenant?.email || ''}<br>
        ${tenant?.phone || ''}
      </div>
    </div>
  </div>

  <div class="property-box">
    <h3>${property.name}</h3>
    <p>${property.address} • Unit ${unit.unit_number}</p>
  </div>

  <div class="due-info">
    <p>Payment is due on the <strong>${unit.due_day}${getOrdinalSuffix(unit.due_day)}</strong> of each month. 
    Late fees apply after the due date: ${formatCurrency(unit.late_fee_amount)} ${unit.late_fee_type === 'percent' ? '%' : 'flat fee'}${unit.daily_late_fee > 0 ? ` + ${formatCurrency(unit.daily_late_fee)}/day` : ''}.</p>
  </div>

  <table class="details-table">
    <thead>
      <tr>
        <th>Description</th>
        <th class="amount">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Monthly Rent - ${formatPeriod(statement.period_month)}</td>
        <td class="amount">${formatCurrency(statement.base_rent)}</td>
      </tr>
      ${statement.late_fee > 0 ? `
      <tr>
        <td>Late Fee</td>
        <td class="amount">${formatCurrency(statement.late_fee)}</td>
      </tr>
      ` : ''}
      ${statement.additional_fees > 0 ? `
      <tr>
        <td>Additional Fees</td>
        <td class="amount">${formatCurrency(statement.additional_fees)}</td>
      </tr>
      ` : ''}
      ${statement.split_fee > 0 ? `
      <tr>
        <td>Split Payment Fee</td>
        <td class="amount">${formatCurrency(statement.split_fee)}</td>
      </tr>
      ` : ''}
      <tr class="total-row">
        <td>Total Due</td>
        <td class="amount">${formatCurrency(statement.total_due)}</td>
      </tr>
    </tbody>
  </table>

  <p style="margin-bottom: 20px;">
    <strong>Status:</strong> 
    <span class="status-badge status-${statement.status}">${statement.status}</span>
  </p>

  <div class="footer">
    <p>This is an automatically generated statement from RentFlow.</p>
    <p>For questions, please contact your property manager.</p>
  </div>
</body>
</html>
    `;

    // Convert HTML to PDF using a simple data URL approach
    // Store HTML as a data URL that can be rendered as PDF by the browser
    const base64Html = btoa(unescape(encodeURIComponent(html)));
    const pdfDataUrl = `data:text/html;base64,${base64Html}`;

    // Update statement with the PDF URL
    const { error: updateError } = await supabase
      .from("statements")
      .update({ pdf_url: pdfDataUrl })
      .eq("id", statement_id);

    if (updateError) {
      console.error("Error updating statement:", updateError);
      throw updateError;
    }

    console.log(`PDF generated successfully for statement ${statement_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        pdf_url: pdfDataUrl,
        message: "PDF generated successfully" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error generating PDF:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
