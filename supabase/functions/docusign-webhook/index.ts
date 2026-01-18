import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { verifyWebhookSignature, downloadCompletedDocument } from "../_shared/docusign-service.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("DOCUSIGN_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("DOCUSIGN_WEBHOOK_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get webhook signature from header
    const signature = req.headers.get("X-DocuSign-Signature-1");
    const payload = await req.text();

    // Verify signature (if provided)
    if (signature) {
      const isValid = await verifyWebhookSignature(payload, signature, webhookSecret);
      if (!isValid) {
        console.error("Invalid webhook signature");
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const event = JSON.parse(payload);
    const eventType = event.event || event.eventType;

    console.log(`Received DocuSign webhook: ${eventType}`, event);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find lease by envelope ID
    const envelopeId = event.data?.envelopeId || event.envelopeId;
    if (!envelopeId) {
      console.error("No envelope ID in webhook payload");
      return new Response(
        JSON.stringify({ error: "No envelope ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select("*")
      .eq("docusign_envelope_id", envelopeId)
      .single();

    if (leaseError || !lease) {
      console.error("Lease not found for envelope:", envelopeId);
      // Return 200 to prevent DocuSign retries for invalid envelopes
      return new Response(
        JSON.stringify({ message: "Lease not found, but acknowledged" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if event already processed (idempotency)
    const { data: existingEvent } = await supabase
      .from("lease_events")
      .select("id")
      .eq("lease_id", lease.id)
      .eq("type", mapEventType(eventType))
      .eq("payload_json->>envelope_id", envelopeId)
      .maybeSingle();

    if (existingEvent) {
      console.log("Event already processed, skipping");
      return new Response(
        JSON.stringify({ message: "Event already processed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map DocuSign event to lease status
    let newStatus: string | null = null;
    let eventTypeMapped: string = mapEventType(eventType);

    switch (eventType) {
      case "envelope-sent":
      case "envelope.created":
        newStatus = "sent";
        eventTypeMapped = "sent";
        break;
      case "envelope-delivered":
      case "envelope.delivered":
        newStatus = "delivered";
        eventTypeMapped = "delivered";
        break;
      case "envelope-signed":
      case "envelope.signed":
        newStatus = "signed";
        eventTypeMapped = "signed";
        break;
      case "envelope-completed":
      case "envelope.completed":
        newStatus = "completed";
        eventTypeMapped = "completed";
        break;
      case "envelope-declined":
      case "envelope.declined":
        newStatus = "declined";
        eventTypeMapped = "declined";
        break;
      case "envelope-voided":
      case "envelope.voided":
        newStatus = "voided";
        eventTypeMapped = "voided";
        break;
    }

    // Update lease status if needed
    if (newStatus && newStatus !== lease.status) {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      // If completed, download and store the signed PDF
      if (newStatus === "completed") {
        try {
          const pdfBuffer = await downloadCompletedDocument(
            supabase,
            lease.landlord_id,
            envelopeId
          );

          // Upload to storage
          const fileName = `leases/signed/${lease.id}.pdf`;
          const { error: uploadError } = await supabase.storage
            .from("leases")
            .upload(fileName, pdfBuffer, {
              contentType: "application/pdf",
              upsert: true,
            });

          if (!uploadError) {
            // Get signed URL
            const { data: urlData } = await supabase.storage
              .from("leases")
              .createSignedUrl(fileName, 31536000); // 1 year expiry

            updateData.pdf_signed_url = urlData?.signedUrl || fileName;
          } else {
            console.error("Error uploading signed PDF:", uploadError);
          }
        } catch (pdfError) {
          console.error("Error downloading signed PDF:", pdfError);
          // Don't fail the webhook if PDF download fails
        }
      }

      await supabase
        .from("leases")
        .update(updateData)
        .eq("id", lease.id);
    }

    // Create lease event
    await supabase
      .from("lease_events")
      .insert({
        lease_id: lease.id,
        type: eventTypeMapped,
        payload_json: event,
      });

    // Send email notifications for key events
    if (newStatus === "completed" || newStatus === "declined" || newStatus === "delivered") {
      try {
        await supabase.functions.invoke("send-lease-email", {
          body: {
            lease_id: lease.id,
            type: newStatus === "completed" ? "lease_completed" : 
                  newStatus === "declined" ? "lease_declined" : "lease_delivered",
          },
        });
      } catch (emailError) {
        console.error("Email sending error (non-critical):", emailError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Webhook processed",
        lease_id: lease.id,
        status: newStatus || lease.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    // Return 200 to prevent DocuSign retries for processing errors
    // Log the error for investigation
    return new Response(
      JSON.stringify({ error: error.message, acknowledged: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function mapEventType(eventType: string): string {
  const mapping: Record<string, string> = {
    "envelope-sent": "sent",
    "envelope.created": "sent",
    "envelope-delivered": "delivered",
    "envelope.delivered": "delivered",
    "envelope-signed": "signed",
    "envelope.signed": "signed",
    "envelope-completed": "completed",
    "envelope.completed": "completed",
    "envelope-declined": "declined",
    "envelope.declined": "declined",
    "envelope-voided": "voided",
    "envelope.voided": "voided",
  };
  return mapping[eventType] || eventType;
}
