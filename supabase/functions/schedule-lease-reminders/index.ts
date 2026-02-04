import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAYS_SINCE_SENT_BEFORE_REMINDER = 3;
const REMINDER_COOLDOWN_DAYS = 7;
const EXPIRY_THRESHOLDS_DAYS = [90, 60, 30];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!authHeader?.startsWith("Bearer ") && !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - DAYS_SINCE_SENT_BEFORE_REMINDER * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - REMINDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

    let needsSigningCount = 0;
    let aboutToExpireCount = 0;

    // 1) Leases sent/delivered but not signed – remind tenant (lease_needs_signing)
    const { data: pendingLeases } = await supabase
      .from("leases")
      .select("id")
      .in("status", ["sent", "delivered"])
      .lt("updated_at", threeDaysAgo.toISOString());

    for (const lease of pendingLeases ?? []) {
      const { data: recentReminder } = await supabase
        .from("lease_events")
        .select("id")
        .eq("lease_id", lease.id)
        .eq("type", "reminder_sent")
        .gte("created_at", sevenDaysAgo.toISOString())
        .contains("payload_json", { subtype: "lease_needs_signing" })
        .limit(1)
        .maybeSingle();

      if (recentReminder) continue;

      try {
        await supabase.functions.invoke("send-lease-email", {
          body: { lease_id: lease.id, type: "lease_needs_signing" },
        });
        needsSigningCount++;
      } catch (e) {
        console.error("send-lease-email lease_needs_signing error:", e);
      }
    }

    // 2) Leases completed and end_date approaching – remind both (lease_about_to_expire)
    for (const days of EXPIRY_THRESHOLDS_DAYS) {
      const from = new Date(now);
      from.setDate(from.getDate() + days);
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);

      const { data: expiringLeases } = await supabase
        .from("leases")
        .select("id")
        .eq("status", "completed")
        .not("end_date", "is", null)
        .gte("end_date", from.toISOString().slice(0, 10))
        .lt("end_date", to.toISOString().slice(0, 10));

      for (const lease of expiringLeases ?? []) {
        const { data: alreadySent } = await supabase
          .from("lease_events")
          .select("id")
          .eq("lease_id", lease.id)
          .eq("type", "reminder_sent")
          .contains("payload_json", { subtype: "lease_about_to_expire", days_left: days })
          .limit(1)
          .maybeSingle();

        if (alreadySent) continue;

        try {
          await supabase.functions.invoke("send-lease-email", {
            body: { lease_id: lease.id, type: "lease_about_to_expire", days_left: days, recipient: "tenant" },
          });
          await supabase.functions.invoke("send-lease-email", {
            body: { lease_id: lease.id, type: "lease_about_to_expire", days_left: days, recipient: "landlord" },
          });
          aboutToExpireCount++;
        } catch (e) {
          console.error("send-lease-email lease_about_to_expire error:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        needs_signing_reminders_sent: needsSigningCount,
        about_to_expire_reminders_sent: aboutToExpireCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("schedule-lease-reminders error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
