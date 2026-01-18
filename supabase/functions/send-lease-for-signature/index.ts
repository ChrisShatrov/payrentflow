import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getDocuSignTokens, createEnvelope } from "../_shared/docusign-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lease_id } = await req.json();

    if (!lease_id) {
      return new Response(
        JSON.stringify({ error: "lease_id is required" }),
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

    // Fetch lease with related data
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select(`
        *,
        units!inner(
          *,
          properties!inner(*)
        ),
        profiles:tenant_id(*),
        lease_templates(*)
      `)
      .eq("id", lease_id)
      .single();

    if (leaseError || !lease) {
      return new Response(
        JSON.stringify({ error: "Lease not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user owns the lease
    if (lease.landlord_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already sent
    if (lease.status !== "draft" && lease.status !== "sent") {
      return new Response(
        JSON.stringify({ error: `Lease is already ${lease.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get PDF - handle both signed URLs and storage paths
    const supabaseService = createClient(supabaseUrl, supabaseKey);
    let pdfArrayBuffer: ArrayBuffer;
    
    console.log("Lease pdf_draft_url:", lease.pdf_draft_url);
    
    if (lease.pdf_draft_url && lease.pdf_draft_url.startsWith("http")) {
      // It's a signed URL - fetch it directly
      console.log("Fetching PDF from signed URL");
      try {
        const pdfResponse = await fetch(lease.pdf_draft_url);
        if (!pdfResponse.ok) {
          throw new Error(`Failed to fetch PDF from URL: ${pdfResponse.status} ${pdfResponse.statusText}`);
        }
        pdfArrayBuffer = await pdfResponse.arrayBuffer();
        console.log("Successfully fetched PDF from signed URL, size:", pdfArrayBuffer.byteLength);
      } catch (fetchError: any) {
        console.error("Error fetching PDF from signed URL:", fetchError);
        // Fall back to storage path
        console.log("Falling back to storage path");
        const pdfPath = `leases/draft/${lease.id}.pdf`;
        const { data: pdfData, error: pdfError } = await supabaseService.storage
          .from("leases")
          .download(pdfPath);
        
        if (pdfError || !pdfData) {
          console.error("PDF download error from storage:", pdfError);
          return new Response(
            JSON.stringify({ 
              error: "PDF not found",
              details: pdfError?.message || "PDF file does not exist in storage",
              attempted_url: lease.pdf_draft_url,
              attempted_path: pdfPath
            }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        pdfArrayBuffer = await pdfData.arrayBuffer();
      }
    } else {
      // It's a storage path or we need to use default
      const pdfPath = lease.pdf_draft_url || `leases/draft/${lease.id}.pdf`;
      console.log("Downloading PDF from storage path:", pdfPath);
      
      const { data: pdfData, error: pdfError } = await supabaseService.storage
        .from("leases")
        .download(pdfPath);

      if (pdfError || !pdfData) {
        console.error("PDF download error:", pdfError);
        console.error("PDF path attempted:", pdfPath);
        
        // Try default path as fallback
        const defaultPath = `leases/draft/${lease.id}.pdf`;
        if (pdfPath !== defaultPath) {
          console.log("Trying default path:", defaultPath);
          const { data: altPdfData, error: altPdfError } = await supabaseService.storage
            .from("leases")
            .download(defaultPath);
          
          if (altPdfError || !altPdfData) {
            console.error("PDF not found at default path either:", altPdfError);
            return new Response(
              JSON.stringify({ 
                error: "PDF not found",
                details: pdfError?.message || "PDF file does not exist in storage",
                attempted_path: pdfPath,
                fallback_path: defaultPath
              }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          pdfArrayBuffer = await altPdfData.arrayBuffer();
        } else {
          return new Response(
            JSON.stringify({ 
              error: "PDF not found",
              details: pdfError?.message || "PDF file does not exist in storage",
              attempted_path: pdfPath
            }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        pdfArrayBuffer = await pdfData.arrayBuffer();
      }
    }

    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfArrayBuffer)));
    console.log("PDF converted to base64, length:", pdfBase64.length);

    // Get landlord and tenant info
    const { data: landlord } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", lease.landlord_id)
      .single();

    const tenant = lease.profiles;

    // Create DocuSign envelope
    const recipients = [
      {
        email: landlord.email,
        name: landlord.full_name || landlord.email,
        role: "Signer",
      },
      {
        email: tenant.email,
        name: tenant.full_name || tenant.email,
        role: "Signer",
        clientUserId: tenant.id, // For embedded signing
      },
    ];

    const envelopeId = await createEnvelope(
      supabaseService,
      lease.landlord_id,
      pdfBase64,
      `Lease Agreement - ${lease.units.unit_number}.pdf`,
      recipients,
      "Please sign your lease agreement",
      `Please review and sign the lease agreement for ${lease.units.properties.name}, Unit ${lease.units.unit_number}.`
    );

    // Update lease with envelope ID and status
    const { error: updateError } = await supabase
      .from("leases")
      .update({
        docusign_envelope_id: envelopeId,
        status: "sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", lease_id);

    if (updateError) {
      console.error("Error updating lease:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update lease" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create lease event
    await supabase
      .from("lease_events")
      .insert({
        lease_id: lease.id,
        type: "sent",
        payload_json: { envelope_id: envelopeId },
      });

    // Send email notification (will be handled by separate function or webhook)
    // For now, trigger email service
    try {
      await supabaseService.functions.invoke("send-lease-email", {
        body: {
          lease_id: lease.id,
          type: "lease_ready",
        },
      });
    } catch (emailError) {
      console.error("Email sending error (non-critical):", emailError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        envelope_id: envelopeId,
        message: "Lease sent for signature",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending lease for signature:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to send lease for signature",
        details: error.stack || String(error)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
