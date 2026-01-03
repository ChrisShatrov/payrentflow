import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: 
    | "payment_success" 
    | "payment_failed" 
    | "late_fee_applied" 
    | "statement_generated"
    | "unit_updated";
  tenant_id?: string;
  landlord_id?: string;
  data: {
    amount?: number;
    unit_number?: string;
    property_name?: string;
    period_month?: string;
    late_fee?: number;
    daily_late_fee?: number;
    total_due?: number;
    changes?: string[];
  };
}

const formatCurrency = (cents: number): string => {
  return `$${(cents / 100).toFixed(2)}`;
};

const formatPeriod = (period: string): string => {
  const [month, year] = period.split('/');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const getEmailTemplate = (type: string, data: NotificationRequest['data']): { subject: string; html: string } => {
  const baseStyles = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 0; 
    padding: 0; 
    background-color: #f4f4f5;
  `;

  const headerGradient = "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)";

  switch (type) {
    case "payment_success":
      return {
        subject: `Payment Received - ${data.property_name} Unit ${data.unit_number}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="${baseStyles}">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <tr>
                  <td style="background: ${headerGradient}; border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
                    <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                      <span style="font-size: 32px;">✓</span>
                    </div>
                    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Payment Successful</h1>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: white; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <table width="100%" style="margin-bottom: 24px; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Property</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${data.property_name}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Unit</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${data.unit_number}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Period</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${data.period_month ? formatPeriod(data.period_month) : 'N/A'}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Amount Paid</span><br>
                          <span style="color: #10b981; font-size: 24px; font-weight: 700;">${data.amount ? formatCurrency(data.amount) : '$0.00'}</span>
                        </td>
                      </tr>
                    </table>
                    <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
                      This is an automated notification from RentFlow.
                    </p>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `,
      };

    case "payment_failed":
      return {
        subject: `Payment Failed - ${data.property_name} Unit ${data.unit_number}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="${baseStyles}">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
                    <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                      <span style="font-size: 32px;">✕</span>
                    </div>
                    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Payment Failed</h1>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: white; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                      <p style="color: #991b1b; font-size: 14px; margin: 0;">
                        <strong>A $10.00 failed ACH fee has been applied</strong> to your account due to the failed bank transfer.
                      </p>
                    </div>
                    <table width="100%" style="margin-bottom: 24px; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Property</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${data.property_name}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Unit</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${data.unit_number}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <span style="color: #6b7280; font-size: 14px;">New Amount Due</span><br>
                          <span style="color: #ef4444; font-size: 24px; font-weight: 700;">${data.total_due ? formatCurrency(data.total_due) : '$0.00'}</span>
                        </td>
                      </tr>
                    </table>
                    <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
                      Please log in to RentFlow to retry your payment.
                    </p>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `,
      };

    case "late_fee_applied":
      return {
        subject: `Late Fee Applied - ${data.property_name} Unit ${data.unit_number}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="${baseStyles}">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <tr>
                  <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
                    <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                      <span style="font-size: 32px;">⏰</span>
                    </div>
                    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Late Fee Applied</h1>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: white; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                      <p style="color: #92400e; font-size: 14px; margin: 0;">
                        Your rent payment is overdue. A late fee has been applied to your account.
                      </p>
                    </div>
                    <table width="100%" style="margin-bottom: 24px; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Property</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${data.property_name}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Unit</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${data.unit_number}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Period</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${data.period_month ? formatPeriod(data.period_month) : 'N/A'}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Late Fee</span><br>
                          <span style="color: #f59e0b; font-size: 20px; font-weight: 700;">${data.late_fee ? formatCurrency(data.late_fee) : '$0.00'}</span>
                          ${data.daily_late_fee ? `<br><span style="color: #92400e; font-size: 12px;">+ $${(data.daily_late_fee / 100).toFixed(2)}/day</span>` : ''}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Total Amount Due</span><br>
                          <span style="color: #ef4444; font-size: 24px; font-weight: 700;">${data.total_due ? formatCurrency(data.total_due) : '$0.00'}</span>
                        </td>
                      </tr>
                    </table>
                    <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
                      Please log in to RentFlow to pay your balance.
                    </p>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `,
      };

    case "statement_generated":
      return {
        subject: `New Rent Statement - ${data.period_month ? formatPeriod(data.period_month) : 'New Period'}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="${baseStyles}">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <tr>
                  <td style="background: ${headerGradient}; border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
                    <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                      <span style="font-size: 32px;">📄</span>
                    </div>
                    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">New Statement Available</h1>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: white; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                      Your rent statement for <strong>${data.period_month ? formatPeriod(data.period_month) : 'the new period'}</strong> is now available.
                    </p>
                    <table width="100%" style="margin-bottom: 24px; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Property</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${data.property_name}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Unit</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${data.unit_number}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Amount Due</span><br>
                          <span style="color: #6366f1; font-size: 24px; font-weight: 700;">${data.total_due ? formatCurrency(data.total_due) : '$0.00'}</span>
                        </td>
                      </tr>
                    </table>
                    <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
                      Log in to RentFlow to view details and make a payment.
                    </p>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `,
      };

    case "unit_updated":
      return {
        subject: `Unit Details Updated - ${data.property_name} Unit ${data.unit_number}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="${baseStyles}">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <tr>
                  <td style="background: ${headerGradient}; border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
                    <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                      <span style="font-size: 32px;">🏠</span>
                    </div>
                    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Unit Details Updated</h1>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: white; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                      The following details have been updated for <strong>${data.property_name} - Unit ${data.unit_number}</strong>:
                    </p>
                    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                      <ul style="color: #374151; font-size: 14px; margin: 0; padding-left: 20px;">
                        ${(data.changes || []).map(change => `<li style="margin-bottom: 8px;">${change}</li>`).join('')}
                      </ul>
                    </div>
                    <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
                      This is an automated notification from RentFlow.
                    </p>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `,
      };

    default:
      return {
        subject: "RentFlow Notification",
        html: `<p>You have a new notification from RentFlow.</p>`,
      };
  }
};

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

    const { type, tenant_id, landlord_id, data }: NotificationRequest = await req.json();

    console.log(`Sending ${type} notification`, { tenant_id, landlord_id, data });

    const resend = new Resend(resendApiKey);
    const recipients: string[] = [];

    // Get tenant email if provided
    if (tenant_id) {
      const { data: tenant } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", tenant_id)
        .single();
      
      if (tenant?.email) {
        recipients.push(tenant.email);
        console.log(`Added tenant email: ${tenant.email}`);
      }
    }

    // Get landlord email if provided
    if (landlord_id) {
      const { data: landlord } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", landlord_id)
        .single();
      
      if (landlord?.email) {
        recipients.push(landlord.email);
        console.log(`Added landlord email: ${landlord.email}`);
      }
    }

    if (recipients.length === 0) {
      console.log("No recipients found, skipping email");
      return new Response(
        JSON.stringify({ success: true, message: "No recipients found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { subject, html } = getEmailTemplate(type, data);

    const { error: emailError } = await resend.emails.send({
      from: "RentFlow <onboarding@resend.dev>",
      to: recipients,
      subject,
      html,
    });

    if (emailError) {
      console.error("Email error:", emailError);
      throw new Error("Failed to send notification email");
    }

    console.log(`Successfully sent ${type} email to ${recipients.join(", ")}`);

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent", recipients }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
