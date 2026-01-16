import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TenantEmailRequest {
  type: "maintenance" | "contact" | "help";
  subject: string;
  message: string;
  unit_number?: string;
  property_name?: string;
  tenant_name: string;
  tenant_email: string;
  custom_subject?: string;
}

const HELP_EMAIL = "support@payrentflow.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const body: TenantEmailRequest = await req.json();
    console.log("Received tenant email request:", JSON.stringify(body, null, 2));

    const { type, subject, message, unit_number, property_name, tenant_name, tenant_email, custom_subject } = body;

    let recipientEmail: string;
    let emailSubject: string;
    let emailHtml: string;

    if (type === "help") {
      // Help emails go to support
      recipientEmail = HELP_EMAIL;
      emailSubject = `HELP REQUEST - ${subject}`;
      emailHtml = generateHelpEmail(tenant_name, tenant_email, subject, message);
    } else {
      // Maintenance and Contact emails go to landlord
      // Find the landlord's email based on the unit
      const { data: unitData, error: unitError } = await supabase
        .from("units")
        .select(`
          property:properties (
            landlord_id
          )
        `)
        .eq("unit_number", unit_number)
        .maybeSingle();

      if (unitError || !unitData) {
        console.error("Error finding unit:", unitError);
        throw new Error("Could not find unit information");
      }

      const landlordId = (unitData.property as any)?.landlord_id;
      if (!landlordId) {
        throw new Error("Could not find landlord for this unit");
      }

      // Get landlord's email
      const { data: landlordProfile, error: profileError } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", landlordId)
        .single();

      if (profileError || !landlordProfile) {
        console.error("Error finding landlord profile:", profileError);
        throw new Error("Could not find landlord email");
      }

      recipientEmail = landlordProfile.email;

      if (type === "maintenance") {
        emailSubject = `MAINTENANCE REQUEST - Unit ${unit_number}: ${custom_subject || subject}`;
        emailHtml = generateMaintenanceEmail(tenant_name, tenant_email, property_name || "", unit_number || "", custom_subject || subject, message);
      } else {
        emailSubject = `Message from Tenant - Unit ${unit_number}: ${subject}`;
        emailHtml = generateContactEmail(tenant_name, tenant_email, property_name || "", unit_number || "", subject, message);
      }
    }

    console.log(`Sending ${type} email to: ${recipientEmail}`);

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "RentFlow <support@payrentflow.com>";
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: [recipientEmail],
      subject: emailSubject,
      html: emailHtml,
      reply_to: tenant_email,
    });

    if (emailError) {
      console.error("Error sending email:", emailError);
      throw emailError;
    }

    console.log("Email sent successfully:", emailData);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-tenant-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

function generateMaintenanceEmail(
  tenantName: string,
  tenantEmail: string,
  propertyName: string,
  unitNumber: string,
  subject: string,
  message: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <tr>
            <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
              <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 32px;">🔧</span>
              </div>
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Maintenance Request</h1>
            </td>
          </tr>
          <tr>
            <td style="background-color: white; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              <table width="100%" style="margin-bottom: 24px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: #6b7280; font-size: 14px;">From</span><br>
                    <span style="color: #111827; font-size: 16px; font-weight: 500;">${tenantName}</span><br>
                    <span style="color: #6b7280; font-size: 14px;">${tenantEmail}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: #6b7280; font-size: 14px;">Property</span><br>
                    <span style="color: #111827; font-size: 16px; font-weight: 500;">${propertyName} - Unit ${unitNumber}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: #6b7280; font-size: 14px;">Subject</span><br>
                    <span style="color: #111827; font-size: 16px; font-weight: 500;">${subject}</span>
                  </td>
                </tr>
              </table>
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; margin: 0 0 8px;">Message</p>
                <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
              </div>
              <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
                Reply directly to this email to respond to the tenant.
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function generateContactEmail(
  tenantName: string,
  tenantEmail: string,
  propertyName: string,
  unitNumber: string,
  subject: string,
  message: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
              <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 32px;">💬</span>
              </div>
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Message from Tenant</h1>
            </td>
          </tr>
          <tr>
            <td style="background-color: white; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              <table width="100%" style="margin-bottom: 24px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: #6b7280; font-size: 14px;">From</span><br>
                    <span style="color: #111827; font-size: 16px; font-weight: 500;">${tenantName}</span><br>
                    <span style="color: #6b7280; font-size: 14px;">${tenantEmail}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: #6b7280; font-size: 14px;">Property</span><br>
                    <span style="color: #111827; font-size: 16px; font-weight: 500;">${propertyName} - Unit ${unitNumber}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: #6b7280; font-size: 14px;">Subject</span><br>
                    <span style="color: #111827; font-size: 16px; font-weight: 500;">${subject}</span>
                  </td>
                </tr>
              </table>
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; margin: 0 0 8px;">Message</p>
                <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
              </div>
              <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
                Reply directly to this email to respond to the tenant.
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

function generateHelpEmail(
  tenantName: string,
  tenantEmail: string,
  subject: string,
  message: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
              <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 32px;">❓</span>
              </div>
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Help Request</h1>
            </td>
          </tr>
          <tr>
            <td style="background-color: white; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              <table width="100%" style="margin-bottom: 24px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: #6b7280; font-size: 14px;">From</span><br>
                    <span style="color: #111827; font-size: 16px; font-weight: 500;">${tenantName}</span><br>
                    <span style="color: #6b7280; font-size: 14px;">${tenantEmail}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: #6b7280; font-size: 14px;">Subject</span><br>
                    <span style="color: #111827; font-size: 16px; font-weight: 500;">${subject}</span>
                  </td>
                </tr>
              </table>
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; margin: 0 0 8px;">Message</p>
                <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
              </div>
              <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
                Reply directly to this email to respond to the user.
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
