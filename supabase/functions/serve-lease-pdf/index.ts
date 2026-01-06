import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const unitId = url.searchParams.get("unitId");

    if (!unitId) {
      console.error("Missing unitId parameter");
      return new Response(JSON.stringify({ error: "Missing unitId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with user's auth
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`User ${user.id} requesting lease for unit ${unitId}`);

    // Fetch unit with RLS - this ensures user has access
    const { data: unit, error: unitError } = await supabase
      .from("units")
      .select("lease_pdf_url, property_id")
      .eq("id", unitId)
      .single();

    if (unitError || !unit) {
      console.error("Unit fetch error:", unitError);
      return new Response(JSON.stringify({ error: "Unit not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!unit.lease_pdf_url) {
      console.error("No lease uploaded for unit");
      return new Response(JSON.stringify({ error: "No lease uploaded" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Fetching lease from storage: ${unit.lease_pdf_url}`);

    // Use service role to access storage
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Generate signed URL
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from("leases")
      .createSignedUrl(unit.lease_pdf_url, 60);

    if (signedError || !signedData?.signedUrl) {
      console.error("Error creating signed URL:", signedError);
      return new Response(JSON.stringify({ error: "Failed to access lease file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the PDF from Supabase storage
    const pdfResponse = await fetch(signedData.signedUrl);
    if (!pdfResponse.ok) {
      console.error("Error fetching PDF:", pdfResponse.status);
      return new Response(JSON.stringify({ error: "Failed to fetch lease file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    console.log(`Successfully fetched PDF, size: ${pdfBuffer.byteLength} bytes`);

    // Stream PDF back from our domain
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="lease-${unitId}.pdf"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
