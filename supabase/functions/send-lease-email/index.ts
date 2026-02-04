import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lease_id, type, days_left, recipient } = await req.json();

    if (!lease_id || !type) {
      return new Response(
        JSON.stringify({ error: "lease_id and type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch lease with related data
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select(`
        *,
        units!inner(
          unit_number,
          properties!inner(
            name,
            address
          )
        ),
        profiles:tenant_id(*),
        lease_templates(name)
      `)
      .eq("id", lease_id)
      .single();

    if (leaseError || !lease) {
      return new Response(
        JSON.stringify({ error: "Lease not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get landlord info
    const { data: landlord } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", lease.landlord_id)
      .single();

    const tenant = lease.profiles;
    const property = lease.units.properties;
    const unit = lease.units;

    const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
    const leaseUrl = `${frontendUrl}/tenant/leases/${lease_id}`;

    let emailSubject = "";
    let emailHtml = "";
    let recipientEmail = "";
    let recipientName = "";

    switch (type) {
      case "lease_ready":
        // Send to tenant
        recipientEmail = tenant.email;
        recipientName = tenant.full_name || tenant.email;
        emailSubject = `Lease Agreement Ready to Sign - ${property.name}`;
        emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #6366f1; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f9fafb; }
              .button { display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Lease Agreement Ready to Sign</h1>
              </div>
              <div class="content">
                <p>Hello ${recipientName},</p>
                <p>Your landlord has prepared a lease agreement for you to review and sign.</p>
                <p><strong>Property:</strong> ${property.name}</p>
                <p><strong>Unit:</strong> ${unit.unit_number}</p>
                <p><strong>Address:</strong> ${property.address}</p>
                <p style="text-align: center;">
                  <a href="${leaseUrl}" class="button">Review & Sign Lease</a>
                </p>
                <p>You can also copy and paste this link into your browser:</p>
                <p style="word-break: break-all;">${leaseUrl}</p>
                <p>Please review the lease agreement carefully and sign it at your earliest convenience.</p>
              </div>
              <div class="footer">
                <p>This is an automated message from RentFlow.</p>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      case "lease_completed":
        // Send to both landlord and tenant
        const signedPdfUrl = lease.pdf_signed_url 
          ? `${frontendUrl}/api/leases/${lease_id}/download`
          : null;

        // Email to tenant
        recipientEmail = tenant.email;
        recipientName = tenant.full_name || tenant.email;
        emailSubject = `Lease Agreement Fully Executed - ${property.name}`;
        emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f9fafb; }
              .button { display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Lease Agreement Fully Executed</h1>
              </div>
              <div class="content">
                <p>Hello ${recipientName},</p>
                <p>Great news! Your lease agreement has been fully executed by all parties.</p>
                <p><strong>Property:</strong> ${property.name}</p>
                <p><strong>Unit:</strong> ${unit.unit_number}</p>
                <p><strong>Address:</strong> ${property.address}</p>
                ${signedPdfUrl ? `
                  <p style="text-align: center;">
                    <a href="${signedPdfUrl}" class="button">Download Executed Lease</a>
                  </p>
                ` : ''}
                <p>You can view and download your executed lease agreement from your tenant portal at any time.</p>
              </div>
              <div class="footer">
                <p>This is an automated message from RentFlow.</p>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      case "lease_delivered":
        // Send to tenant (reminder)
        recipientEmail = tenant.email;
        recipientName = tenant.full_name || tenant.email;
        emailSubject = `Reminder: Please Sign Your Lease Agreement - ${property.name}`;
        emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f9fafb; }
              .button { display: inline-block; padding: 12px 24px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Reminder: Sign Your Lease</h1>
              </div>
              <div class="content">
                <p>Hello ${recipientName},</p>
                <p>This is a friendly reminder that your lease agreement is waiting for your signature.</p>
                <p><strong>Property:</strong> ${property.name}</p>
                <p><strong>Unit:</strong> ${unit.unit_number}</p>
                <p style="text-align: center;">
                  <a href="${leaseUrl}" class="button">Sign Lease Now</a>
                </p>
                <p>Please sign the lease agreement at your earliest convenience to complete the process.</p>
              </div>
              <div class="footer">
                <p>This is an automated message from RentFlow.</p>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      case "lease_declined":
        // Send to landlord
        recipientEmail = landlord.email;
        recipientName = landlord.full_name || landlord.email;
        emailSubject = `Lease Agreement Declined - ${property.name}`;
        emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f9fafb; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Lease Agreement Declined</h1>
              </div>
              <div class="content">
                <p>Hello ${recipientName},</p>
                <p>The tenant has declined to sign the lease agreement.</p>
                <p><strong>Property:</strong> ${property.name}</p>
                <p><strong>Unit:</strong> ${unit.unit_number}</p>
                <p><strong>Tenant:</strong> ${tenant.full_name || tenant.email}</p>
                <p>Please contact the tenant or create a new lease agreement if needed.</p>
              </div>
              <div class="footer">
                <p>This is an automated message from RentFlow.</p>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      case "lease_needs_signing":
        // Send to tenant (reminder to sign)
        recipientEmail = tenant.email;
        recipientName = tenant.full_name || tenant.email;
        emailSubject = `Reminder: Please Sign Your Lease - ${property.name}`;
        emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f9fafb; }
              .button { display: inline-block; padding: 12px 24px; background-color: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Lease Needs Your Signature</h1>
              </div>
              <div class="content">
                <p>Hello ${recipientName},</p>
                <p>This is a reminder that your lease agreement is still waiting for your signature.</p>
                <p><strong>Property:</strong> ${property.name}</p>
                <p><strong>Unit:</strong> ${unit.unit_number}</p>
                <p style="text-align: center;">
                  <a href="${leaseUrl}" class="button">Sign Lease Now</a>
                </p>
                <p>Please sign at your earliest convenience to complete the process.</p>
              </div>
              <div class="footer">
                <p>This is an automated message from RentFlow.</p>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      case "lease_about_to_expire":
        // recipient: "tenant" | "landlord" (caller sends two requests)
        const daysLeft = typeof days_left === "number" ? days_left : 30;
        recipientEmail = recipient === "landlord" ? landlord.email : tenant.email;
        recipientName = recipient === "landlord" ? (landlord.full_name || landlord.email) : (tenant.full_name || tenant.email);
        emailSubject = `Lease Expiring in ${daysLeft} Days - ${property.name}`;
        emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #6366f1; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f9fafb; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Lease Expiring Soon</h1>
              </div>
              <div class="content">
                <p>Hello ${recipientName},</p>
                <p>Your lease agreement for <strong>${property.name}</strong>, Unit ${unit.unit_number} will expire in ${daysLeft} days.</p>
                <p>Consider discussing renewal or move-out with ${recipient === "landlord" ? "your tenant" : "your landlord"}.</p>
              </div>
              <div class="footer">
                <p>This is an automated message from RentFlow.</p>
              </div>
            </div>
          </body>
          </html>
        `;
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown email type: ${type}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Send email via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "RentFlow <noreply@rentflow.com>", // Update with your verified domain
        to: recipientEmail,
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend API error:", errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const emailResult = await emailResponse.json();

    // Log email event if it's a reminder (caller may also insert with subtype for schedule-lease-reminders)
    if (type === "lease_delivered" || type === "lease_needs_signing" || type === "lease_about_to_expire") {
      await supabase
        .from("lease_events")
        .insert({
          lease_id: lease.id,
          type: "reminder_sent",
          payload_json: {
            email_id: emailResult.id,
            subtype: type === "lease_about_to_expire" ? "lease_about_to_expire" : type === "lease_needs_signing" ? "lease_needs_signing" : "lease_delivered",
            days_left: type === "lease_about_to_expire" ? days_left : undefined,
          },
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully",
        email_id: emailResult.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
