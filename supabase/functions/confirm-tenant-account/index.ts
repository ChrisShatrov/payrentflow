import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmRequest {
  user_id: string;
  invite_token: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, invite_token }: ConfirmRequest = await req.json();

    if (!user_id || !invite_token) {
      return new Response(
        JSON.stringify({ error: "user_id and invite_token are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify invite token is valid and not expired
    const { data: invite, error: inviteError } = await supabase
      .from("tenant_invites")
      .select("id, email, used_at, expires_at")
      .eq("invite_token", invite_token)
      .maybeSingle();

    if (inviteError) {
      console.error("Error checking invite:", inviteError);
      return new Response(
        JSON.stringify({ error: "Failed to verify invite token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!invite) {
      return new Response(
        JSON.stringify({ error: "Invalid invite token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (invite.used_at) {
      return new Response(
        JSON.stringify({ error: "This invite has already been used" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    if (now > expiresAt) {
      return new Response(
        JSON.stringify({ error: "This invite has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user's email matches the invite email
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(user_id);
    if (userError || !user.user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (user.user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Email mismatch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Confirm the user's email
    const { data: updatedUser, error: confirmError } = await supabase.auth.admin.updateUserById(
      user_id,
      { email_confirm: true }
    );

    if (confirmError) {
      console.error("Error confirming user:", confirmError);
      return new Response(
        JSON.stringify({ error: "Failed to confirm user account" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark invite as used
    await supabase
      .from("tenant_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id);

    return new Response(
      JSON.stringify({ success: true, message: "Account confirmed successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
