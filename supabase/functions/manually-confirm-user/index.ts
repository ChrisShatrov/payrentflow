import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmRequest {
  email?: string;
  user_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, user_id }: ConfirmRequest = await req.json();

    if (!email && !user_id) {
      return new Response(
        JSON.stringify({ error: "Either email or user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let targetUserId: string;

    // If email provided, find user by email
    if (email) {
      const { data: users, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        return new Response(
          JSON.stringify({ error: "Failed to list users" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!user) {
        return new Response(
          JSON.stringify({ error: "User not found with that email" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      targetUserId = user.id;
    } else {
      targetUserId = user_id!;
    }

    // Get user to check current status
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(targetUserId);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already confirmed
    if (userData.user.email_confirmed_at) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "User is already confirmed",
          user: {
            id: userData.user.id,
            email: userData.user.email,
            email_confirmed_at: userData.user.email_confirmed_at
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Confirm the user's email
    const { data: updatedUser, error: confirmError } = await supabase.auth.admin.updateUserById(
      targetUserId,
      { email_confirm: true }
    );

    if (confirmError) {
      console.error("Error confirming user:", confirmError);
      return new Response(
        JSON.stringify({ error: "Failed to confirm user account", details: confirmError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Account confirmed successfully",
        user: {
          id: updatedUser.user.id,
          email: updatedUser.user.email,
          email_confirmed_at: updatedUser.user.email_confirmed_at
        }
      }),
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
