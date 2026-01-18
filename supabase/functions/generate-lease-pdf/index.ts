import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sanitize HTML to prevent XSS and remove external resources
function sanitizeHtml(html: string): string {
  // Remove script tags
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove event handlers
  html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  // Remove javascript: URLs
  html = html.replace(/javascript:/gi, '');
  // Remove external stylesheets (keep inline styles)
  html = html.replace(/<link[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi, '');
  // Remove external images (keep data URIs)
  html = html.replace(/<img[^>]*src\s*=\s*["'](?!data:)[^"']*["'][^>]*>/gi, '');
  return html;
}

// Replace template variables with actual values
function replaceVariables(html: string, variables: Record<string, any>): string {
  let result = html;
  // Replace {{variable_name}} with actual values
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, String(value || ''));
  }
  return result;
}

// Extract variables from template body
function extractVariables(html: string): string[] {
  const matches = html.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  const variables = matches.map(match => match.replace(/\{\{|\}\}/g, ''));
  return [...new Set(variables)]; // Remove duplicates
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { template_id, lease_data_json, lease_id } = await req.json();

    if (!template_id || !lease_data_json) {
      return new Response(
        JSON.stringify({ error: "template_id and lease_data_json are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth header for user context (optional when called from service role)
    const authHeader = req.headers.get("Authorization");
    // Note: Authorization is optional when called from another Edge Function with service role

    // Fetch template
    const { data: template, error: templateError } = await supabase
      .from("lease_templates")
      .select("*")
      .eq("id", template_id)
      .single();

    if (templateError || !template) {
      console.error("Template not found:", templateError);
      return new Response(
        JSON.stringify({ error: "Template not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize and replace variables
    let html = sanitizeHtml(template.body_html);
    html = replaceVariables(html, lease_data_json);

    // Wrap in a complete HTML document with styling
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 1in;
      background: white;
    }
    h1, h2, h3 {
      color: #1a1a1a;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }
    p {
      margin: 0.5em 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 0.5em;
      text-align: left;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    @media print {
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;

    // Generate PDF using Browserless
    const browserlessBaseUrl = Deno.env.get("BROWSERLESS_URL") || "https://chrome.browserless.io";
    const browserlessToken = Deno.env.get("BROWSERLESS_TOKEN");
    
    // Build URL with token as query parameter (Browserless API format)
    const browserlessUrl = `${browserlessBaseUrl}/pdf${browserlessToken ? `?token=${browserlessToken}` : ''}`;
    
    const pdfResponse = await fetch(browserlessUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html: fullHtml,
        options: {
          format: "Letter",
          margin: {
            top: "0.5in",
            right: "0.5in",
            bottom: "0.5in",
            left: "0.5in",
          },
          printBackground: true,
        },
      }),
    });

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error("Browserless API error:", errorText);
      throw new Error(`PDF generation failed: ${pdfResponse.status} ${errorText}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();

    // Upload to Supabase Storage
    const fileName = lease_id 
      ? `leases/draft/${lease_id}.pdf`
      : `leases/draft/temp_${Date.now()}.pdf`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("leases")
      .upload(fileName, new Uint8Array(pdfBuffer), {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading PDF:", uploadError);
      throw uploadError;
    }

    // Get signed URL (private bucket, so we need signed URL)
    const { data: urlData } = await supabase.storage
      .from("leases")
      .createSignedUrl(fileName, 3600); // 1 hour expiry

    const pdfUrl = urlData?.signedUrl || fileName;

    console.log(`PDF generated successfully: ${fileName}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        pdf_url: pdfUrl,
        file_path: fileName,
        message: "PDF generated successfully" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error generating PDF:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate PDF" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
