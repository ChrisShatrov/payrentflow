import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  fullName: string;
  phone: string | null;
  unitId: string | null;
  move_in_date: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Create client for user auth (uses Authorization header)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get("Authorization") || "" },
      },
    });
    
    // Create service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get landlord_id from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Invalid authentication");
    }
    const landlordId = user.id;

    const { email, fullName, phone, unitId, move_in_date }: InviteRequest = await req.json();
    const normalizedEmail = email.toLowerCase();

    // Generate invite token (UUID)
    const inviteToken = crypto.randomUUID();

    // Check if profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("email", normalizedEmail)
      .maybeSingle();

    let profileId: string;

    let userAlreadyExists = false;
    let isExistingUser = false;

    // If profile exists, check if there's a corresponding auth user
    if (existingProfile) {
      try {
        // Try to get the auth user by ID (profiles.id should match auth.users.id if user signed up)
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(existingProfile.id);
        
        if (authUser?.user) {
          // Auth user exists - we'll still send the invite (re-invite)
          console.log(`User with email ${normalizedEmail} already has an auth account (ID: ${existingProfile.id}) - sending re-invite`);
          userAlreadyExists = true;
          isExistingUser = true;
        }
      } catch (error: any) {
        // If getUserById fails (user doesn't exist), that's fine - it's an orphaned profile
        console.log(`Profile exists for ${normalizedEmail} but no auth user found - will update profile`);
      }

      // Only allow updating if it's not already assigned to a different role
      if (existingProfile.role && existingProfile.role !== "tenant" && !isExistingUser) {
        throw new Error(`A profile with this email already exists with role "${existingProfile.role}". Cannot invite as tenant.`);
      }

      // Update profile if not an existing user, or if we need to update details
      if (!isExistingUser) {
        const { data: updatedProfile, error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({
            full_name: fullName,
            phone: phone,
            role: "tenant",
          })
          .eq("id", existingProfile.id)
          .select()
          .single();

        if (updateError) throw updateError;
        profileId = updatedProfile.id;
      } else {
        // User already exists, just use existing profile ID
        profileId = existingProfile.id;
      }
    } else {
      // Check if auth user exists by email (might have signed up but profile wasn't created)
      try {
        const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (!listError && authUsers?.users) {
          const existingAuthUser = authUsers.users.find(u => u.email?.toLowerCase() === normalizedEmail);
          if (existingAuthUser) {
            console.log(`Auth user exists for ${normalizedEmail} but no profile - will create profile and send re-invite`);
            userAlreadyExists = true;
            // Create profile for existing auth user
            const { data: newProfile, error: profileError } = await supabaseAdmin
              .from("profiles")
              .insert({
                id: existingAuthUser.id, // Use the same ID as auth user
                email: normalizedEmail,
                full_name: fullName,
                phone: phone,
                role: "tenant",
              })
              .select()
              .single();

            if (profileError) {
              // If insert fails (maybe profile was just created), try to update
              const { data: existingProfile } = await supabaseAdmin
                .from("profiles")
                .select("id")
                .eq("id", existingAuthUser.id)
                .maybeSingle();
              
              if (existingProfile) {
                profileId = existingProfile.id;
              } else {
                throw profileError;
              }
            } else {
              profileId = newProfile.id;
            }
          }
        }
      } catch (error: any) {
        if (error.code !== "PGRST116" && !error.message?.includes("duplicate")) {
          console.warn("Could not check auth users:", error.message);
        }
      }

      // Create new profile for the tenant if we haven't already
      if (!profileId) {
        const { data: newProfile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .insert({
            email: normalizedEmail,
            full_name: fullName,
            phone: phone,
            role: "tenant",
          })
          .select()
          .single();

        if (profileError) throw profileError;
        profileId = newProfile.id;
      }
    }

    // Get property and unit info for email
    let propertyName: string | null = null;
    let unitNumber: string | null = null;
    
    if (unitId) {
      const { data: unitData, error: unitError } = await supabaseAdmin
        .from("units")
        .select("unit_number, property_id, properties!inner(name)")
        .eq("id", unitId)
        .single();

      if (!unitError && unitData) {
        unitNumber = unitData.unit_number;
        propertyName = (unitData.properties as any)?.name || null;
        
        // Update unit with tenant assignment and move_in_date
        const updateData: any = { tenant_id: profileId };
        if (move_in_date) {
          updateData.move_in_date = move_in_date;
        }
        
        const { error: updateUnitError } = await supabaseAdmin
          .from("units")
          .update(updateData)
          .eq("id", unitId);

        if (updateUnitError) {
          console.error("Error assigning unit:", updateUnitError);
        }
      }
    }

    // Store invite in tenant_invites table
    const { error: inviteError } = await supabaseAdmin
      .from("tenant_invites")
      .insert({
        email: normalizedEmail,
        invite_token: inviteToken,
        landlord_id: landlordId,
        unit_id: unitId || null,
        move_in_date: move_in_date || null,
      });

    if (inviteError) {
      console.error("Error storing invite:", inviteError);
      // Continue anyway - invite can still work without tracking
    }

    // Generate signup link with invite token
    const origin = req.headers.get("origin") || supabaseUrl.replace(".supabase.co", "");
    const signupUrl = `${origin}/auth?invite_token=${inviteToken}&email=${encodeURIComponent(email)}`;

      // Send invite email
      const resend = new Resend(resendApiKey);
      // Use environment variable for from address, fallback to test domain
      // IMPORTANT: Gmail addresses cannot be used as "from" addresses in Resend
      // You must verify your own domain at https://resend.com/domains
      // For production: Set RESEND_FROM_EMAIL env var to your verified domain email
      // e.g., "RentFlow <noreply@yourdomain.com>"
      const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "RentFlow <support@payrentflow.com>";
      const { error: emailError } = await resend.emails.send({
        from: fromEmail,
      to: [email],
      subject: "You've been invited to RentFlow",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <tr>
                <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 16px 16px 0 0; padding: 50px 40px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Welcome to RentFlow</h1>
                  <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0; font-size: 16px;">Pay Rent, Stress-Free</p>
                </td>
              </tr>
              <tr>
                <td style="background-color: white; padding: 40px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                  <p style="color: #374151; font-size: 18px; line-height: 1.6; margin: 0 0 16px; font-weight: 600;">
                    Hi ${fullName},
                  </p>
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                    ${userAlreadyExists 
                        ? "You already have an account on RentFlow. Click the button below to sign in to your tenant account." 
                        : "You've been invited to join RentFlow as a tenant. We're excited to have you on board!"}
                  </p>
                  ${propertyName || unitNumber || move_in_date ? `
                  <div style="background-color: #f9fafb; border-left: 4px solid #6366f1; padding: 20px; margin: 24px 0; border-radius: 8px;">
                    ${propertyName ? `<p style="color: #374151; font-size: 15px; margin: 0 0 8px; font-weight: 600;">🏠 Property: ${propertyName}</p>` : ''}
                    ${unitNumber ? `<p style="color: #374151; font-size: 15px; margin: 0 0 8px;">📍 Unit: ${unitNumber}</p>` : ''}
                    ${move_in_date ? `<p style="color: #374151; font-size: 15px; margin: 0;">📅 Move-in Date: ${new Date(move_in_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
                  </div>
                  ` : ''}
                  <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 24px 0 30px;">
                    ${userAlreadyExists 
                        ? "Click the button below to access your tenant dashboard where you can view statements, make payments, and manage your account." 
                        : "Click the button below to create your account and get started. You'll be able to view your rent statements, make payments, and stay up to date with everything related to your tenancy."}
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                          <a href="${signupUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.3); transition: all 0.2s;">
                            ${userAlreadyExists ? "Sign In to Your Account" : "Create Your Account"}
                          </a>
                      </td>
                    </tr>
                  </table>
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0; text-align: center;">
                    If you didn't expect this invitation, you can safely ignore this email.
                  </p>
                  <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                      This invitation was sent by your landlord. If you have any questions, please contact them directly.
                    </p>
                  </div>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

      if (emailError) {
        console.error("Email error:", emailError);
        // Provide helpful error message for Resend domain issues
        if (emailError.statusCode === 403 && emailError.message?.includes("testing emails")) {
          throw new Error(
            "Email sending failed: You need to verify a domain in Resend to send emails to all recipients. " +
            "Go to https://resend.com/domains to verify your domain, then set the RESEND_FROM_EMAIL environment variable " +
            "to use your verified domain (e.g., 'RentFlow <noreply@yourdomain.com>'). " +
            `Current error: ${emailError.message}`
          );
        }
        throw new Error(`Failed to send invitation email: ${emailError.message || "Unknown error"}`);
      }

    return new Response(
      JSON.stringify({ success: true, message: "Invite sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
