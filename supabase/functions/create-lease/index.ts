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
    const { 
      unit_id, 
      tenant_id, 
      template_id, 
      lease_data_json,
      send_for_signature = false 
    } = await req.json();

    if (!unit_id || !tenant_id || !template_id || !lease_data_json) {
      return new Response(
        JSON.stringify({ error: "unit_id, tenant_id, template_id, and lease_data_json are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is landlord and owns the unit
    const { data: unit, error: unitError } = await supabase
      .from("units")
      .select(`
        *,
        properties!inner(
          id,
          landlord_id
        )
      `)
      .eq("id", unit_id)
      .single();

    if (unitError || !unit) {
      return new Response(
        JSON.stringify({ error: "Unit not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (unit.properties.landlord_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: You don't own this unit" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify template belongs to landlord
    const { data: template, error: templateError } = await supabase
      .from("lease_templates")
      .select("*")
      .eq("id", template_id)
      .eq("landlord_id", user.id)
      .single();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({ error: "Template not found or unauthorized" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate draft PDF by calling the function directly
    const functionUrl = `${supabaseUrl}/functions/v1/generate-lease-pdf`;
    const pdfResponse = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "apikey": supabaseKey,
      },
      body: JSON.stringify({
        template_id,
        lease_data_json,
      }),
    });

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error("PDF generation error:", pdfResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: "Failed to generate PDF",
          details: errorText
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfData = await pdfResponse.json();
    if (!pdfData?.pdf_url) {
      console.error("PDF generation failed: No PDF URL returned", pdfData);
      return new Response(
        JSON.stringify({ 
          error: "Failed to generate PDF: No PDF URL returned",
          details: pdfData
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create lease record
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .insert({
        landlord_id: user.id,
        tenant_id,
        unit_id,
        template_id,
        lease_data_json,
        status: send_for_signature ? "sent" : "draft",
        pdf_draft_url: pdfData.pdf_url,
      })
      .select()
      .single();

    if (leaseError || !lease) {
      console.error("Lease creation error:", leaseError);
      return new Response(
        JSON.stringify({ error: "Failed to create lease record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update PDF with lease_id if needed
    // Note: The PDF generation function already handles the file path correctly
    // This section is kept for potential future use if we need to rename files

    // Create lease event
    await supabase
      .from("lease_events")
      .insert({
        lease_id: lease.id,
        type: "created",
        payload_json: { created_by: user.id },
      });

    // If send_for_signature is true, create DocuSign envelope
    if (send_for_signature) {
      // This will be handled by a separate function call
      // For now, just return the lease
    }

    return new Response(
      JSON.stringify({
        success: true,
        lease,
        pdf_url: pdfData.pdf_url,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error creating lease:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to create lease" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
