import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getEmbeddedSigningUrl } from "../_shared/docusign-service.ts";

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

    // Fetch lease
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select("*")
      .eq("id", lease_id)
      .single();

    if (leaseError || !lease) {
      return new Response(
        JSON.stringify({ error: "Lease not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is the tenant
    if (lease.tenant_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: You are not the tenant for this lease" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if lease is ready for signing
    if (lease.status !== "sent" && lease.status !== "delivered") {
      return new Response(
        JSON.stringify({ error: `Lease is not ready for signing. Current status: ${lease.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!lease.docusign_envelope_id) {
      return new Response(
        JSON.stringify({ error: "DocuSign envelope not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tenant email
    const { data: tenant } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single();

    if (!tenant) {
      return new Response(
        JSON.stringify({ error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get return URL
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
    const returnUrl = `${frontendUrl}/tenant/leases/${lease_id}/signed`;

    // Get embedded signing URL
    const supabaseService = createClient(supabaseUrl, supabaseKey);
    const signingUrl = await getEmbeddedSigningUrl(
      supabaseService,
      lease.landlord_id,
      lease.docusign_envelope_id,
      tenant.email,
      returnUrl
    );

    return new Response(
      JSON.stringify({
        success: true,
        signing_url: signingUrl,
        return_url: returnUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error getting embedded signing URL:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to get signing URL" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
