import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple encryption/decryption using Web Crypto API
// In production, consider using Supabase Vault or a more robust solution
async function encryptToken(token: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const keyData = encoder.encode(key.slice(0, 32).padEnd(32, '0'));
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  // Base64 encode
  return btoa(String.fromCharCode(...combined));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: { redirect_uri?: string } = {};
    try {
      body = req.method === "POST" && req.body ? await req.json() : {};
    } catch {
      // ignore
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

    // Verify user is a landlord
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: "Only landlords can connect DocuSign" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const integrationKey = Deno.env.get("DOCUSIGN_INTEGRATION_KEY");
    const secretKey = Deno.env.get("DOCUSIGN_SECRET_KEY");
    const baseUrl = Deno.env.get("DOCUSIGN_BASE_URL") || "https://account-d.docusign.com";
    // Use frontend URL as redirect so DocuSign redirects to the app; the app then calls docusign-callback with auth
    const redirectUri = body.redirect_uri || Deno.env.get("DOCUSIGN_REDIRECT_URI") || 
      `${supabaseUrl.replace('/rest/v1', '')}/functions/v1/docusign-callback`;

    console.log("DocuSign configuration check:", {
      hasIntegrationKey: !!integrationKey,
      hasSecretKey: !!secretKey,
      baseUrl,
      redirectUri,
      userId: user.id
    });

    if (!integrationKey || !secretKey) {
      console.error("DocuSign credentials missing:", {
        hasIntegrationKey: !!integrationKey,
        hasSecretKey: !!secretKey
      });
      return new Response(
        JSON.stringify({ 
          error: "DocuSign credentials not configured",
          details: "Please set DOCUSIGN_INTEGRATION_KEY and DOCUSIGN_SECRET_KEY environment variables in your Supabase project settings"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already connected
    const { data: existingIntegration } = await supabase
      .from("docusign_integrations")
      .select("*")
      .eq("landlord_id", user.id)
      .maybeSingle();

    if (existingIntegration) {
      // Check if token is still valid
      const expiresAt = new Date(existingIntegration.expires_at);
      if (expiresAt > new Date()) {
        return new Response(
          JSON.stringify({ 
            connected: true,
            account_id: existingIntegration.account_id,
            account_name: existingIntegration.account_name,
            message: "Already connected" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate state parameter for OAuth (CSRF protection)
    const state = crypto.randomUUID();
    
    // Store state temporarily (you might want to use Redis or similar in production)
    // For now, we'll include it in the redirect URL and verify in callback

    // Build OAuth authorization URL
    const authUrl = new URL(`${baseUrl}/oauth/auth`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'signature impersonation');
    authUrl.searchParams.set('client_id', integrationKey);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', `${state}:${user.id}`); // Include user ID in state

    return new Response(
      JSON.stringify({ 
        auth_url: authUrl.toString(),
        state: state
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error initiating DocuSign OAuth:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to initiate OAuth" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
