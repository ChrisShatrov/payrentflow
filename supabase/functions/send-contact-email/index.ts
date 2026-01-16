import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactEmailRequest {
  email: string;
  subject: string;
  message: string;
}

const CONTACT_EMAIL = "support@payrentflow.com";

function generateContactEmail(email: string, subject: string, message: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Contact Form Submission</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #00C6FF 0%, #0072FF 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">New Contact Form Submission</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
          <div style="margin-bottom: 20px;">
            <h2 style="color: #0072FF; margin-top: 0; font-size: 18px; font-weight: 600;">From:</h2>
            <p style="background: white; padding: 15px; border-radius: 5px; border: 1px solid #e0e0e0; margin: 0;">
              <a href="mailto:${email}" style="color: #0072FF; text-decoration: none;">${email}</a>
            </p>
          </div>
          <div style="margin-bottom: 20px;">
            <h2 style="color: #0072FF; margin-top: 0; font-size: 18px; font-weight: 600;">Subject:</h2>
            <p style="background: white; padding: 15px; border-radius: 5px; border: 1px solid #e0e0e0; margin: 0;">${subject}</p>
          </div>
          <div style="margin-bottom: 20px;">
            <h2 style="color: #0072FF; margin-top: 0; font-size: 18px; font-weight: 600;">Message:</h2>
            <div style="background: white; padding: 15px; border-radius: 5px; border: 1px solid #e0e0e0; white-space: pre-wrap; word-wrap: break-word;">${message}</div>
          </div>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
            <p style="margin: 0;">This message was sent from the RentFlow contact form. Reply directly to this email to respond to ${email}.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const resend = new Resend(resendApiKey);
    const body: ContactEmailRequest = await req.json();
    
    console.log("Received contact email request:", JSON.stringify(body, null, 2));

    const { email, subject, message } = body;

    if (!email || !subject || !message) {
      return new Response(
        JSON.stringify({ error: "Email, subject, and message are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "RentFlow <support@payrentflow.com>";
    const emailSubject = `Contact Form: ${subject}`;
    const emailHtml = generateContactEmail(email.trim(), subject, message);

    console.log(`Sending contact email to: ${CONTACT_EMAIL} from: ${email}`);

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: [CONTACT_EMAIL],
      reply_to: email.trim(),
      subject: emailSubject,
      html: emailHtml,
    });

    if (emailError) {
      console.error("Error sending email:", emailError);
      throw emailError;
    }

    console.log("Email sent successfully:", emailData);

    return new Response(
      JSON.stringify({ success: true, message: "Contact email sent successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-contact-email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send contact email" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
