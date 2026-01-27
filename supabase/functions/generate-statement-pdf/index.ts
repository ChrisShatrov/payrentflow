import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

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
          move_in_date,
          due_day,
          late_fee_amount,
          daily_late_fee,
          late_fee_type,
          tenant_id,
          property_id,
          addons,
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

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // US Letter size
    const { width, height } = page.getSize();

    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const primaryColor = rgb(0.39, 0.4, 0.95); // Indigo
    const textColor = rgb(0.12, 0.12, 0.12);
    const grayColor = rgb(0.42, 0.45, 0.49);
    const lightGray = rgb(0.96, 0.96, 0.96);

    let y = height - 50;

    // Header
    page.drawText("RentFlow", {
      x: 50,
      y,
      size: 24,
      font: helveticaBold,
      color: primaryColor,
    });

    page.drawText("Rent Statement", {
      x: width - 170,
      y,
      size: 18,
      font: helveticaBold,
      color: textColor,
    });

    y -= 18;
    page.drawText(formatPeriod(statement.period_month), {
      x: width - 170,
      y,
      size: 11,
      font: helvetica,
      color: grayColor,
    });

    const today = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    y -= 14;
    page.drawText(`Generated: ${today}`, {
      x: width - 170,
      y,
      size: 10,
      font: helvetica,
      color: grayColor,
    });

    // Divider line
    y -= 25;
    page.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      thickness: 2,
      color: primaryColor,
    });

    // From/To section
    y -= 35;
    page.drawText("FROM (LANDLORD)", {
      x: 50,
      y,
      size: 9,
      font: helvetica,
      color: grayColor,
    });

    page.drawText("TO (TENANT)", {
      x: 320,
      y,
      size: 9,
      font: helvetica,
      color: grayColor,
    });

    y -= 18;
    page.drawText(landlord?.full_name || "Property Manager", {
      x: 50,
      y,
      size: 14,
      font: helveticaBold,
      color: textColor,
    });

    page.drawText(tenant?.full_name || "Tenant", {
      x: 320,
      y,
      size: 14,
      font: helveticaBold,
      color: textColor,
    });

    y -= 16;
    if (landlord?.email) {
      page.drawText(landlord.email, {
        x: 50,
        y,
        size: 10,
        font: helvetica,
        color: grayColor,
      });
    }

    if (tenant?.email) {
      page.drawText(tenant.email, {
        x: 320,
        y,
        size: 10,
        font: helvetica,
        color: grayColor,
      });
    }

    y -= 14;
    if (landlord?.phone) {
      page.drawText(landlord.phone, {
        x: 50,
        y,
        size: 10,
        font: helvetica,
        color: grayColor,
      });
    }

    if (tenant?.phone) {
      page.drawText(tenant.phone, {
        x: 320,
        y,
        size: 10,
        font: helvetica,
        color: grayColor,
      });
    }

    // Property box
    y -= 40;
    page.drawRectangle({
      x: 50,
      y: y - 45,
      width: width - 100,
      height: 55,
      color: lightGray,
      borderWidth: 0,
    });

    page.drawText(property.name, {
      x: 65,
      y: y - 18,
      size: 13,
      font: helveticaBold,
      color: textColor,
    });

    page.drawText(`${property.address} • Unit ${unit.unit_number}`, {
      x: 65,
      y: y - 35,
      size: 10,
      font: helvetica,
      color: grayColor,
    });

    // Due date info box
    y -= 75;
    page.drawRectangle({
      x: 50,
      y: y - 35,
      width: width - 100,
      height: 40,
      color: rgb(0.94, 0.96, 1),
      borderWidth: 1,
      borderColor: rgb(0.75, 0.86, 0.99),
    });

    const lateFeeText = unit.late_fee_type === 'percent' 
      ? `${unit.late_fee_amount}%` 
      : formatCurrency(unit.late_fee_amount);
    const dailyFeeText = unit.daily_late_fee > 0 
      ? ` + ${formatCurrency(unit.daily_late_fee)}/day` 
      : '';

    page.drawText(`Payment is due on the ${unit.due_day}${getOrdinalSuffix(unit.due_day)} of each month. Late fees apply after the due date: ${lateFeeText}${dailyFeeText}.`, {
      x: 65,
      y: y - 22,
      size: 10,
      font: helvetica,
      color: rgb(0.12, 0.25, 0.69),
    });

    // Table header
    y -= 65;
    page.drawText("DESCRIPTION", {
      x: 50,
      y,
      size: 9,
      font: helvetica,
      color: grayColor,
    });

    page.drawText("AMOUNT", {
      x: width - 100,
      y,
      size: 9,
      font: helvetica,
      color: grayColor,
    });

    // Divider
    y -= 10;
    page.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      thickness: 1,
      color: rgb(0.9, 0.9, 0.9),
    });

    // Base rent row
    y -= 25;
    
    // Check if this statement was pro-rated
    const isProrated = unit.move_in_date && statement.base_rent !== unit.monthly_rent;
    
    if (isProrated) {
      // Show pro-rated information
      const moveInDate = new Date(unit.move_in_date);
      const [statementMonth, statementYear] = statement.period_month.split('/').map(Number);
      const statementMonthEnd = new Date(statementYear, statementMonth, 0);
      const moveInDateFormatted = moveInDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const monthEndFormatted = statementMonthEnd.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      page.drawText(`Pro-rated Rent - ${formatPeriod(statement.period_month)}`, {
        x: 50,
        y,
        size: 11,
        font: helvetica,
        color: textColor,
      });

      page.drawText(formatCurrency(statement.base_rent), {
        x: width - 100,
        y,
        size: 11,
        font: helvetica,
        color: textColor,
      });
      
      // Add pro-rated details below
      y -= 15;
      page.drawText(`(Pro-rated from ${moveInDateFormatted} to ${monthEndFormatted})`, {
        x: 50,
        y,
        size: 9,
        font: helvetica,
        color: grayColor,
      });
      
      y -= 12;
      page.drawText(`Monthly Rent: ${formatCurrency(unit.monthly_rent)} → Pro-rated: ${formatCurrency(statement.base_rent)}`, {
        x: 50,
        y,
        size: 9,
        font: helvetica,
        color: grayColor,
      });
    } else {
      // Regular monthly rent
      page.drawText(`Monthly Rent - ${formatPeriod(statement.period_month)}`, {
        x: 50,
        y,
        size: 11,
        font: helvetica,
        color: textColor,
      });

      page.drawText(formatCurrency(statement.base_rent), {
        x: width - 100,
        y,
        size: 11,
        font: helvetica,
        color: textColor,
      });
    }

    // Late fee row
    if (statement.late_fee > 0) {
      y -= 10;
      page.drawLine({
        start: { x: 50, y },
        end: { x: width - 50, y },
        thickness: 1,
        color: rgb(0.9, 0.9, 0.9),
      });

      y -= 25;
      page.drawText("Late Fee", {
        x: 50,
        y,
        size: 11,
        font: helvetica,
        color: textColor,
      });

      page.drawText(formatCurrency(statement.late_fee), {
        x: width - 100,
        y,
        size: 11,
        font: helvetica,
        color: textColor,
      });
    }

    // Addons rows
    const unitAddons = (unit.addons as Array<{name: string, price: number}> | null) || [];
    if (Array.isArray(unitAddons) && unitAddons.length > 0) {
      for (const addon of unitAddons) {
        y -= 10;
        page.drawLine({
          start: { x: 50, y },
          end: { x: width - 50, y },
          thickness: 1,
          color: rgb(0.9, 0.9, 0.9),
        });

        y -= 25;
        page.drawText(addon.name, {
          x: 50,
          y,
          size: 11,
          font: helvetica,
          color: textColor,
        });

        page.drawText(formatCurrency(addon.price), {
          x: width - 100,
          y,
          size: 11,
          font: helvetica,
          color: textColor,
        });
      }
    }

    // Additional fees row
    if (statement.additional_fees > 0) {
      y -= 10;
      page.drawLine({
        start: { x: 50, y },
        end: { x: width - 50, y },
        thickness: 1,
        color: rgb(0.9, 0.9, 0.9),
      });

      y -= 25;
      page.drawText("Additional Fees", {
        x: 50,
        y,
        size: 11,
        font: helvetica,
        color: textColor,
      });

      page.drawText(formatCurrency(statement.additional_fees), {
        x: width - 100,
        y,
        size: 11,
        font: helvetica,
        color: textColor,
      });
    }

    // Total row
    y -= 15;
    page.drawRectangle({
      x: 50,
      y: y - 30,
      width: width - 100,
      height: 40,
      color: primaryColor,
    });

    page.drawText("Total Due", {
      x: 65,
      y: y - 17,
      size: 13,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });

    page.drawText(formatCurrency(statement.total_due), {
      x: width - 115,
      y: y - 17,
      size: 14,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });

    // Status
    y -= 55;
    page.drawText("Status: ", {
      x: 50,
      y,
      size: 11,
      font: helveticaBold,
      color: textColor,
    });

    const statusColors: Record<string, { bg: [number, number, number], text: [number, number, number] }> = {
      paid: { bg: [0.82, 0.98, 0.9], text: [0.02, 0.37, 0.27] },
      unpaid: { bg: [0.9, 0.9, 0.9], text: [0.22, 0.25, 0.32] },
      overdue: { bg: [1, 0.89, 0.89], text: [0.6, 0.11, 0.11] },
      partial: { bg: [1, 0.95, 0.78], text: [0.57, 0.25, 0.05] },
    };

    const statusStyle = statusColors[statement.status] || statusColors.unpaid;
    const statusText = statement.status.toUpperCase();
    const statusWidth = helveticaBold.widthOfTextAtSize(statusText, 9) + 16;

    page.drawRectangle({
      x: 100,
      y: y - 5,
      width: statusWidth,
      height: 20,
      color: rgb(...statusStyle.bg as [number, number, number]),
    });

    page.drawText(statusText, {
      x: 108,
      y: y + 2,
      size: 9,
      font: helveticaBold,
      color: rgb(...statusStyle.text as [number, number, number]),
    });

    // Footer
    y = 70;
    page.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      thickness: 1,
      color: rgb(0.9, 0.9, 0.9),
    });

    page.drawText("This is an automatically generated statement from RentFlow.", {
      x: (width - helvetica.widthOfTextAtSize("This is an automatically generated statement from RentFlow.", 9)) / 2,
      y: y - 20,
      size: 9,
      font: helvetica,
      color: grayColor,
    });

    page.drawText("For questions, please contact your property manager.", {
      x: (width - helvetica.widthOfTextAtSize("For questions, please contact your property manager.", 9)) / 2,
      y: y - 34,
      size: 9,
      font: helvetica,
      color: grayColor,
    });

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();

    // Upload to Supabase Storage
    const fileName = `statement_${statement_id}_${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("statements")
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading PDF:", uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("statements")
      .getPublicUrl(fileName);

    const pdfUrl = urlData.publicUrl;

    // Update statement with the PDF URL
    const { error: updateError } = await supabase
      .from("statements")
      .update({ pdf_url: pdfUrl })
      .eq("id", statement_id);

    if (updateError) {
      console.error("Error updating statement:", updateError);
    }

    console.log(`PDF generated successfully for statement ${statement_id}: ${pdfUrl}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        pdf_url: pdfUrl,
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