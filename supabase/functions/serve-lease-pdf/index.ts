import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const leaseId = url.searchParams.get("leaseId");
    const type = url.searchParams.get("type"); // "draft" | "signed"
    const unitId = url.searchParams.get("unitId"); // legacy

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let pdfPathOrUrl: string | null = null;
    let filename = "lease.pdf";

    if (leaseId && type) {
      // New flow: serve by lease_id and type (draft | signed)
      if (!["draft", "signed"].includes(type)) {
        return new Response(JSON.stringify({ error: "type must be draft or signed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: lease, error: leaseError } = await supabase
        .from("leases")
        .select("id, pdf_draft_url, pdf_signed_url, landlord_id, tenant_id")
        .eq("id", leaseId)
        .single();

      if (leaseError || !lease) {
        return new Response(JSON.stringify({ error: "Lease not found or access denied" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isLandlord = lease.landlord_id === user.id;
      const isTenant = lease.tenant_id === user.id;
      if (!isLandlord && !isTenant) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (type === "draft") {
        pdfPathOrUrl = lease.pdf_draft_url ?? null;
        filename = `lease-draft-${leaseId}.pdf`;
      } else {
        pdfPathOrUrl = lease.pdf_signed_url ?? null;
        filename = `lease-signed-${leaseId}.pdf`;
      }
    } else if (unitId) {
      // Legacy: serve by unitId (units.lease_pdf_url)
      const { data: unit, error: unitError } = await supabase
        .from("units")
        .select("lease_pdf_url")
        .eq("id", unitId)
        .single();

      if (unitError || !unit) {
        return new Response(JSON.stringify({ error: "Unit not found or access denied" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pdfPathOrUrl = unit.lease_pdf_url ?? null;
      filename = `lease-${unitId}.pdf`;
    } else {
      return new Response(JSON.stringify({ error: "Provide leaseId and type, or unitId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pdfPathOrUrl) {
      return new Response(JSON.stringify({ error: "No lease PDF available" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isStoragePath = !pdfPathOrUrl.startsWith("http");
    let pdfBuffer: ArrayBuffer;

    if (isStoragePath) {
      const { data: signedData, error: signedError } = await supabaseAdmin.storage
        .from("leases")
        .createSignedUrl(pdfPathOrUrl, 3600);

      if (signedError || !signedData?.signedUrl) {
        console.error("Error creating signed URL:", signedError);
        return new Response(JSON.stringify({ error: "Failed to access lease file" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const pdfResponse = await fetch(signedData.signedUrl);
      if (!pdfResponse.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch lease file" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pdfBuffer = await pdfResponse.arrayBuffer();
    } else {
      const pdfResponse = await fetch(pdfPathOrUrl);
      if (!pdfResponse.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch lease file" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pdfBuffer = await pdfResponse.arrayBuffer();
    }

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
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
