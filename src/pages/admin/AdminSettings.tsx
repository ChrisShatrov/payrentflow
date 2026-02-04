import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Lock, Loader2, Check, Link2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { DocuSignConnectDialog } from "@/components/admin/DocuSignConnectDialog";

const profileSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  phone: z.string().max(20, "Phone must be less than 20 characters").optional(),
});

const emailSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export default function AdminSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (user) {
      fetchProfile();
      setEmail(user.email || "");
    }
  }, [user]);

  // Handle DocuSign OAuth callback: DocuSign redirects here with ?code=...&state=...
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");

    if (urlParams.get("docusign_connected") === "true") {
      toast.success("DocuSign connected successfully!");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (urlParams.get("docusign_error")) {
      const error = urlParams.get("docusign_error");
      toast.error(`DocuSign connection failed: ${error}`);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    if (code && state) {
      const redirectUri = `${window.location.origin}/admin/settings`;
      supabase.functions
        .invoke("docusign-callback", {
          body: { code, state, redirect_uri: redirectUri },
        })
        .then(({ data, error: fnError }) => {
          window.history.replaceState({}, "", window.location.pathname);
          if (fnError) {
            toast.error(`DocuSign connection failed: ${fnError.message}`);
            return;
          }
          if (data?.success) {
            toast.success("DocuSign connected successfully!");
          } else if (data?.error) {
            toast.error(`DocuSign connection failed: ${data.error}`);
          }
        })
        .catch((err) => {
          window.history.replaceState({}, "", window.location.pathname);
          toast.error(`DocuSign connection failed: ${err?.message || "Unknown error"}`);
        });
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user?.id)
        .single();

      if (error) throw error;

      setFullName(data?.full_name || "");
      setPhone(data?.phone || "");
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    const validation = profileSchema.safeParse({ full_name: fullName, phone });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone: phone || null })
        .eq("id", user?.id);

      if (error) throw error;

      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveEmail = async () => {
    const validation = emailSchema.safeParse({ email });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    if (email === user?.email) {
      toast.info("Email is the same as current");
      return;
    }

    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email });

      if (error) throw error;

      toast.success("Confirmation email sent to your new address. Please check your inbox.");
    } catch (error: any) {
      console.error("Error updating email:", error);
      toast.error(error.message || "Failed to update email");
    } finally {
      setSavingEmail(false);
    }
  };

  const handlePasswordReset = async () => {
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user?.email || "", {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setResetSent(true);
      toast.success("Password reset email sent. Check your inbox.");
    } catch (error: any) {
      console.error("Error sending password reset:", error);
      toast.error(error.message || "Failed to send password reset email");
    } finally {
      setSendingReset(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your personal information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <Button onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Email Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Email Address
              </CardTitle>
              <CardDescription>
                Change your email address. You'll need to verify the new address.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button onClick={handleSaveEmail} disabled={savingEmail}>
                {savingEmail ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Email"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Password Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Password
              </CardTitle>
              <CardDescription>
                Request a password reset email to change your password
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={handlePasswordReset}
                disabled={sendingReset || resetSent}
              >
                {sendingReset ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : resetSent ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Reset Email Sent
                  </>
                ) : (
                  "Send Password Reset Email"
                )}
              </Button>
              {resetSent && (
                <p className="text-sm text-muted-foreground mt-2">
                  Check your email inbox for the password reset link.
                </p>
              )}
            </CardContent>
          </Card>

          {/* DocuSign Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                DocuSign Integration
              </CardTitle>
              <CardDescription>
                Connect your DocuSign account to enable electronic signatures for lease agreements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocuSignConnectDialog />
              <p className="text-sm text-muted-foreground mt-4">
                You must connect your DocuSign account through OAuth to send leases for signature. 
                Manual credentials cannot be used for security reasons.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}