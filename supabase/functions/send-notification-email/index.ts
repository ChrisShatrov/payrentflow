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
    | "unit_updated"
    | "unit_assigned";
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
    base_rent?: number;
    past_due_balance?: number;
    changes?: string[];
  };
}

const formatCurrency = (amount: number): string => {
  // Amount can be in dollars or cents, handle both
  const dollars = amount < 1000 ? amount : amount / 100;
  return `$${dollars.toFixed(2)}`;
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

  // RentFlow branding colors: Teal/Blue-green primary
  // Primary: hsl(172 66% 38%) = #2D9B8A (teal)
  // Accent: hsl(16 85% 60%) = #F9734B (warm coral)
  const primaryColor = "#2D9B8A"; // Teal
  const primaryDark = "#1F7A6B"; // Darker teal
  const accentColor = "#F9734B"; // Warm coral
  const headerGradient = `linear-gradient(135deg, ${primaryColor} 0%, ${primaryDark} 100%)`;

  switch (type) {
    case "payment_success":
      return {
        subject: `Payment Received - ${data.property_name || 'Rent Payment'} - ${data.period_month ? formatPeriod(data.period_month) : 'Rent Payment'}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="${baseStyles}">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <!-- Header with RentFlow branding -->
                <tr>
                  <td style="background: ${headerGradient}; border-radius: 12px 12px 0 0; padding: 32px 40px; text-align: center;">
                    <div style="margin-bottom: 20px;">
                      <div style="display: inline-block; width: 48px; height: 48px; background: rgba(255,255,255,0.25); border-radius: 12px; margin: 0 auto; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
                        <span style="font-size: 28px; color: white;">✓</span>
                      </div>
                    </div>
                    <h1 style="color: white; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Payment Received</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 16px; font-weight: 400;">Your rent payment has been successfully processed</p>
                  </td>
                </tr>
                
                <!-- Main Content -->
                <tr>
                  <td style="background-color: white; padding: 0; border-radius: 0 0 12px 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);">
                    <!-- Payment Details Card -->
                    <div style="padding: 40px;">
                      <!-- Amount Highlight -->
                      <div style="background: linear-gradient(135deg, #F0FDFA 0%, #E6FFFA 100%); border: 2px solid ${primaryColor}; border-radius: 12px; padding: 24px; margin-bottom: 32px; text-align: center;">
                        <p style="color: ${primaryDark}; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px 0;">Amount Paid</p>
                        <p style="color: ${primaryColor}; font-size: 36px; font-weight: 700; margin: 0; letter-spacing: -1px;">${data.amount ? formatCurrency(data.amount) : '$0.00'}</p>
                      </div>
                      
                      <!-- Payment Details -->
                      <div style="background-color: #F9FAFB; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                        <h2 style="color: #111827; font-size: 18px; font-weight: 600; margin: 0 0 20px 0; padding-bottom: 12px; border-bottom: 2px solid #E5E7EB;">Payment Details</h2>
                        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                      <tr>
                            <td style="padding: 12px 0; border-bottom: 1px solid #E5E7EB;">
                              <span style="color: #6B7280; font-size: 14px; font-weight: 500; display: block; margin-bottom: 4px;">Property</span>
                              <span style="color: #111827; font-size: 16px; font-weight: 600;">${data.property_name || 'N/A'}</span>
                        </td>
                      </tr>
                      <tr>
                            <td style="padding: 12px 0; border-bottom: 1px solid #E5E7EB;">
                              <span style="color: #6B7280; font-size: 14px; font-weight: 500; display: block; margin-bottom: 4px;">Unit Number</span>
                              <span style="color: #111827; font-size: 16px; font-weight: 600;">${data.unit_number || 'N/A'}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                              <span style="color: #6B7280; font-size: 14px; font-weight: 500; display: block; margin-bottom: 4px;">Payment Period</span>
                              <span style="color: #111827; font-size: 16px; font-weight: 600;">${data.period_month ? formatPeriod(data.period_month) : 'N/A'}</span>
                        </td>
                      </tr>
                    </table>
                      </div>
                      
                      <!-- Success Message -->
                      <div style="background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%); border-left: 4px solid ${primaryColor}; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                        <p style="color: #065F46; font-size: 14px; margin: 0; line-height: 1.6;">
                          <strong style="color: ${primaryDark};">✓ Payment Confirmed</strong><br>
                          Your payment has been successfully processed and your account has been updated.
                        </p>
                      </div>
                      
                      <!-- Footer -->
                      <div style="text-align: center; padding-top: 24px; border-top: 1px solid #E5E7EB;">
                        <p style="color: #6B7280; font-size: 13px; margin: 0 0 8px 0;">
                          This is an automated notification from
                        </p>
                        <p style="margin: 0;">
                          <span style="color: ${primaryColor}; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">Rent</span><span style="color: #111827; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">Flow</span>
                        </p>
                        <p style="color: #9CA3AF; font-size: 12px; margin: 16px 0 0 0;">
                          Thank you for using RentFlow for your rental payments.
                    </p>
                      </div>
                    </div>
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
                  <td style="background: ${headerGradient}; border-radius: 12px 12px 0 0; padding: 32px 40px; text-align: center;">
                    <div style="margin-bottom: 20px;">
                      <div style="display: inline-block; width: 48px; height: 48px; background: rgba(255,255,255,0.25); border-radius: 12px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
                        <span style="font-size: 28px; color: white;">📄</span>
                      </div>
                    </div>
                    <h1 style="color: white; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">New Statement Available</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 16px; font-weight: 400;">Your rent statement is ready</p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: white; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);">
                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                      Your rent statement for <strong>${data.period_month ? formatPeriod(data.period_month) : 'the new period'}</strong> is now available.
                    </p>
                    <div style="background-color: #F9FAFB; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                      ${data.past_due_balance && data.past_due_balance > 0 ? `
                        <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                          <p style="color: #991B1B; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">⚠️ Past Due Balance</p>
                          <p style="color: #DC2626; font-size: 20px; font-weight: 700; margin: 0;">${formatCurrency(data.past_due_balance)}</p>
                          <p style="color: #991B1B; font-size: 12px; margin: 8px 0 0 0;">This amount from previous statements is included in your total due.</p>
                        </div>
                      ` : ''}
                      <table width="100%" style="border-collapse: collapse;">
                      <tr>
                          <td style="padding: 12px 0; border-bottom: 1px solid #E5E7EB;">
                            <span style="color: #6B7280; font-size: 14px; font-weight: 500; display: block; margin-bottom: 4px;">Property</span>
                            <span style="color: #111827; font-size: 16px; font-weight: 600;">${data.property_name}</span>
                        </td>
                      </tr>
                      <tr>
                          <td style="padding: 12px 0; border-bottom: 1px solid #E5E7EB;">
                            <span style="color: #6B7280; font-size: 14px; font-weight: 500; display: block; margin-bottom: 4px;">Unit</span>
                            <span style="color: #111827; font-size: 16px; font-weight: 600;">${data.unit_number}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                            <span style="color: #6B7280; font-size: 14px; font-weight: 500; display: block; margin-bottom: 4px;">Amount Due</span>
                            <span style="color: ${primaryColor}; font-size: 24px; font-weight: 700;">${data.total_due ? formatCurrency(data.total_due) : '$0.00'}</span>
                        </td>
                      </tr>
                    </table>
                    </div>
                    <div style="text-align: center; padding-top: 24px; border-top: 1px solid #E5E7EB;">
                      <p style="color: #6B7280; font-size: 13px; margin: 0 0 8px 0;">This is an automated notification from</p>
                      <p style="margin: 0;">
                        <span style="color: ${primaryColor}; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">Rent</span><span style="color: #111827; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">Flow</span>
                      </p>
                    </div>
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
                  <td style="background: ${headerGradient}; border-radius: 12px 12px 0 0; padding: 32px 40px; text-align: center;">
                    <div style="margin-bottom: 20px;">
                      <div style="display: inline-block; width: 48px; height: 48px; background: rgba(255,255,255,0.25); border-radius: 12px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
                        <span style="font-size: 28px; color: white;">🏠</span>
                      </div>
                    </div>
                    <h1 style="color: white; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Unit Details Updated</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 16px; font-weight: 400;">Your unit information has been changed</p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: white; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);">
                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                      The following details have been updated for <strong>${data.property_name} - Unit ${data.unit_number}</strong>:
                    </p>
                    <div style="background-color: #F9FAFB; border-left: 4px solid ${primaryColor}; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                      <ul style="color: #374151; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.8;">
                        ${(data.changes || []).map(change => `<li style="margin-bottom: 8px;">${change}</li>`).join('')}
                      </ul>
                    </div>
                    <div style="text-align: center; padding-top: 24px; border-top: 1px solid #E5E7EB;">
                      <p style="color: #6B7280; font-size: 13px; margin: 0 0 8px 0;">This is an automated notification from</p>
                      <p style="margin: 0;">
                        <span style="color: ${primaryColor}; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">Rent</span><span style="color: #111827; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">Flow</span>
                    </p>
                    </div>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `,
      };

    case "unit_assigned":
      return {
        subject: `You've been assigned to ${data.property_name || "a property"}${data.unit_number ? ` - Unit ${data.unit_number}` : ""}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="${baseStyles}">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <tr>
                  <td style="background: ${headerGradient}; border-radius: 12px 12px 0 0; padding: 32px 40px; text-align: center;">
                    <div style="margin-bottom: 20px;">
                      <div style="display: inline-block; width: 48px; height: 48px; background: rgba(255,255,255,0.25); border-radius: 12px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
                        <span style="font-size: 28px; color: white;">✓</span>
                      </div>
                    </div>
                    <h1 style="color: white; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">You've been assigned</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 16px; font-weight: 400;">Your landlord has assigned you to a rental unit</p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: white; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);">
                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                      You have been assigned to <strong>${data.property_name || "your property"}</strong>${data.unit_number ? `, Unit <strong>${data.unit_number}</strong>` : ""}.
                    </p>
                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                      Log in to your tenant dashboard to view your rental details, statements, and make payments.
                    </p>
                    <div style="text-align: center; padding-top: 24px; border-top: 1px solid #E5E7EB;">
                      <p style="color: #6B7280; font-size: 13px; margin: 0 0 8px 0;">This is an automated notification from</p>
                      <p style="margin: 0;">
                        <span style="color: ${primaryColor}; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">Rent</span><span style="color: #111827; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">Flow</span>
                    </p>
                    </div>
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

  console.log(`[SEND-NOTIFICATION-EMAIL] Function called`, {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
  });

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("[SEND-NOTIFICATION-EMAIL] ERROR: RESEND_API_KEY is not configured");
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestBody = await req.json();
    console.log(`[SEND-NOTIFICATION-EMAIL] Request body received`, requestBody);

    const { type, tenant_id, landlord_id, data }: NotificationRequest = requestBody;

    console.log(`[SEND-NOTIFICATION-EMAIL] Processing ${type} notification`, { tenant_id, landlord_id, data });

    const resend = new Resend(resendApiKey);
    const recipients: string[] = [];

    // Get tenant email if provided
    if (tenant_id) {
      console.log(`[SEND-NOTIFICATION-EMAIL] Fetching tenant profile`, { tenant_id });
      const { data: tenant, error: tenantError } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", tenant_id)
        .single();
      
      if (tenantError) {
        console.error(`[SEND-NOTIFICATION-EMAIL] Error fetching tenant:`, tenantError);
      } else if (tenant?.email) {
        recipients.push(tenant.email);
        console.log(`[SEND-NOTIFICATION-EMAIL] Added tenant email: ${tenant.email}`);
      } else {
        console.log(`[SEND-NOTIFICATION-EMAIL] No email found for tenant: ${tenant_id}`);
      }
    } else {
      console.log(`[SEND-NOTIFICATION-EMAIL] No tenant_id provided`);
    }

    // Get landlord email if provided
    if (landlord_id) {
      console.log(`[SEND-NOTIFICATION-EMAIL] Fetching landlord profile`, { landlord_id });
      const { data: landlord, error: landlordError } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", landlord_id)
        .single();
      
      if (landlordError) {
        console.error(`[SEND-NOTIFICATION-EMAIL] Error fetching landlord:`, landlordError);
      } else if (landlord?.email) {
        recipients.push(landlord.email);
        console.log(`[SEND-NOTIFICATION-EMAIL] Added landlord email: ${landlord.email}`);
      } else {
        console.log(`[SEND-NOTIFICATION-EMAIL] No email found for landlord: ${landlord_id}`);
      }
    } else {
      console.log(`[SEND-NOTIFICATION-EMAIL] No landlord_id provided`);
    }

    console.log(`[SEND-NOTIFICATION-EMAIL] Total recipients: ${recipients.length}`, { recipients });

    if (recipients.length === 0) {
      console.log("[SEND-NOTIFICATION-EMAIL] No recipients found, skipping email");
      return new Response(
        JSON.stringify({ success: true, message: "No recipients found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { subject, html } = getEmailTemplate(type, data);
    console.log(`[SEND-NOTIFICATION-EMAIL] Email template generated`, { subject, htmlLength: html.length });

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "RentFlow <support@payrentflow.com>";
    
    console.log(`[SEND-NOTIFICATION-EMAIL] Sending email via Resend`, {
      from: fromEmail,
      to: recipients,
      subject,
    });

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: recipients,
      subject,
      html,
    });

    if (emailError) {
      console.error("[SEND-NOTIFICATION-EMAIL] Resend API error:", emailError);
      throw new Error(`Failed to send notification email: ${emailError.message}`);
    }

    console.log(`[SEND-NOTIFICATION-EMAIL] Successfully sent ${type} email`, {
      recipients,
      emailId: emailData?.id,
    });

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent", recipients, emailId: emailData?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[SEND-NOTIFICATION-EMAIL] ERROR:", {
      message: error.message,
      stack: error.stack,
      error: String(error),
    });
    return new Response(
      JSON.stringify({ error: error.message, details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
