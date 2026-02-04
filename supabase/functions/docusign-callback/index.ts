import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple encryption using Web Crypto API
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
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("DocuSign OAuth error:", error);
      // Redirect to frontend with error
      const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
      return Response.redirect(`${frontendUrl}/admin/settings?docusign_error=${error}`);
    }

    if (!code || !state) {
      return new Response("Missing code or state parameter", { status: 400 });
    }

    // Extract user ID from state (format: "state:userId")
    const [stateToken, userId] = state.split(':');
    if (!userId) {
      return new Response("Invalid state parameter", { status: 400 });
    }

    const integrationKey = Deno.env.get("DOCUSIGN_INTEGRATION_KEY");
    const secretKey = Deno.env.get("DOCUSIGN_SECRET_KEY");
    const baseUrl = Deno.env.get("DOCUSIGN_BASE_URL") || "https://account-d.docusign.com";
    const redirectUri = Deno.env.get("DOCUSIGN_REDIRECT_URI") || 
      `${Deno.env.get("SUPABASE_URL")?.replace('/rest/v1', '')}/functions/v1/docusign-callback`;
    const encryptionKey = Deno.env.get("ENCRYPTION_KEY") || integrationKey || "default-key-change-in-production";

    if (!integrationKey || !secretKey) {
      return new Response("DocuSign credentials not configured", { status: 500 });
    }

    // Exchange code for tokens
    const tokenUrl = `${baseUrl}/oauth/token`;
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
      return Response.redirect(`${frontendUrl}/admin/settings?docusign_error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Get user info to get account ID
    const userInfoResponse = await fetch(`${baseUrl}/oauth/userinfo`, {
      headers: {
        "Authorization": `Bearer ${access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error("Failed to get user info");
      const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
      return Response.redirect(`${frontendUrl}/admin/settings?docusign_error=user_info_failed`);
    }

    const userInfo = await userInfoResponse.json();
    const accountId = userInfo.accounts?.[0]?.account_id;
    const accountName = userInfo.accounts?.[0]?.account_name;

    if (!accountId) {
      console.error("No account ID found");
      const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
      return Response.redirect(`${frontendUrl}/admin/settings?docusign_error=no_account_id`);
    }

    // Encrypt tokens
    const accessTokenEncrypted = await encryptToken(access_token, encryptionKey);
    const refreshTokenEncrypted = await encryptToken(refresh_token, encryptionKey);

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + (expires_in * 1000));

    // Store in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: dbError } = await supabase
      .from("docusign_integrations")
      .upsert({
        landlord_id: userId,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        expires_at: expiresAt.toISOString(),
        account_id: accountId,
        account_name: accountName,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "landlord_id",
      });

    if (dbError) {
      console.error("Database error:", dbError);
      const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
      return Response.redirect(`${frontendUrl}/admin/settings?docusign_error=database_error`);
    }

    // Redirect to frontend with success
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
    return Response.redirect(`${frontendUrl}/admin/settings?docusign_connected=true`);
  } catch (error: any) {
    console.error("Error in DocuSign callback:", error);
    const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
    return Response.redirect(`${frontendUrl}/admin/settings?docusign_error=${encodeURIComponent(error.message)}`);
  }
});
