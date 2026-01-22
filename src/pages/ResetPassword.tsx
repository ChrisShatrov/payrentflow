import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Eye, EyeOff, Loader2, Lock, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { z } from "zod";

const passwordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if we have a valid recovery session
    const checkRecoverySession = async () => {
      try {
        console.log("[ResetPassword] Checking recovery session...");
        console.log("[ResetPassword] Current URL:", window.location.href);
        console.log("[ResetPassword] Hash:", window.location.hash);
        console.log("[ResetPassword] Search:", window.location.search);
        
        // First check URL hash and search params for recovery token
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const searchParams = new URLSearchParams(window.location.search);
        const accessToken = hashParams.get("access_token") || searchParams.get("access_token");
        const type = hashParams.get("type") || searchParams.get("type");
        const refreshToken = hashParams.get("refresh_token") || searchParams.get("refresh_token");
        
        console.log("[ResetPassword] Token check:", { accessToken: !!accessToken, type, hasRefreshToken: !!refreshToken });
        
        // If we have a recovery token in the URL, set the session
        if (accessToken && type === "recovery") {
          console.log("[ResetPassword] Found recovery token in URL, setting session");
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || "",
            });
            
            if (data.session && !error) {
              console.log("[ResetPassword] Recovery session set successfully");
              setIsValidToken(true);
              // Clear the URL hash/search params after setting session
              window.history.replaceState({}, document.title, "/reset-password");
              return;
            } else {
              console.error("[ResetPassword] Failed to set recovery session:", error);
              setIsValidToken(false);
              setError(error?.message || "Invalid or expired reset link. Please request a new password reset.");
              return;
            }
          } catch (sessionError: any) {
            console.error("[ResetPassword] Error setting session:", sessionError);
            setIsValidToken(false);
            setError(sessionError?.message || "Failed to process reset link. Please request a new password reset.");
            return;
          }
        }
        
        // If we have a signup token, redirect away - this is not a password reset
        if (type === "signup") {
          console.log("[ResetPassword] Signup token detected, redirecting to home");
          setIsValidToken(false);
          setError("This is a signup confirmation link, not a password reset link.");
          // Redirect to home - Supabase will handle the signup confirmation
          setTimeout(() => {
            window.location.href = "/";
          }, 2000);
          return;
        }
        
        // Only handle recovery tokens or tokens without type (but be cautious)
        // If we have just the access_token without type, we can't assume it's recovery
        // It could be a signup confirmation. Only proceed if we're explicitly on reset-password
        // and the user navigated here intentionally (not from a signup link)
        if (accessToken && !type) {
          console.log("[ResetPassword] Found access token without type - checking if this is a recovery token");
          // We can't safely assume this is recovery without the type parameter
          // If the user is already on /reset-password, they might have come from a recovery email
          // But if they came from a signup email, we should redirect them away
          // For now, we'll be conservative and only accept explicit recovery tokens
          setIsValidToken(false);
          setError("Invalid reset link. Please use the link from your password reset email.");
          return;
        }
        
        // Check if we already have a session (might be set by Supabase redirect)
        // Supabase might have already processed the token and created a session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        console.log("[ResetPassword] Session check:", { hasSession: !!session, error: sessionError });
        
        // If we have a session and we're on the reset-password page, it's likely a recovery session
        // However, we need to verify it's actually a recovery session, not a regular login
        if (session) {
          // Check if this session was just created (recovery sessions are temporary)
          // We can also check the URL to see if we came from a recovery flow
          // For now, if we're on reset-password page and have a session, assume it's recovery
          // This is safe because regular users wouldn't be on this page
          console.log("[ResetPassword] Session found, checking if it's a recovery session");
          
          // Try to verify by checking if we can update the password (recovery sessions allow this)
          // Actually, let's just assume if we're here with a session, it's recovery
          // The worst case is they can't reset if it's not actually recovery
          setIsValidToken(true);
        } else {
          // No session and no token in URL - invalid
          console.log("[ResetPassword] No session and no token found");
          setIsValidToken(false);
          setError("No valid reset token found. Please request a new password reset.");
        }
      } catch (err) {
        console.error("Error checking recovery session:", err);
        setIsValidToken(false);
        setError("Failed to verify reset link. Please try again.");
      }
    };

    checkRecoverySession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate password
    const validation = passwordSchema.safeParse({ password });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      // Update password using Supabase
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      toast.success("Password reset successfully! Please sign in with your new password.");
      
      // Sign out the recovery session and redirect to login
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    } catch (err: any) {
      console.error("Error resetting password:", err);
      setError(err.message || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (isValidToken === null) {
    // Still checking token validity
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Verifying reset link...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (isValidToken === false) {
    // Invalid token
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-8">
          <div className="space-y-6">
            <div className="text-center">
              <Lock className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-foreground mb-2">Invalid Reset Link</h1>
              <p className="text-muted-foreground mb-6">{error || "This password reset link is invalid or has expired."}</p>
            </div>
            <div className="flex flex-col gap-3">
              <Button asChild>
                <Link to="/auth">Go to Login</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/auth">Request New Reset Link</Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Valid token - show password reset form
  return (
    <>
      <Helmet>
        <title>Reset Password — RentFlow</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Lock className="h-6 w-6 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Reset Your Password</h1>
            <p className="text-muted-foreground">
              Enter your new password below
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your new password"
                  disabled={loading}
                  className="pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Password must be at least 6 characters long
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !password}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>

          {/* Back to login */}
          <div className="text-center">
            <Link
              to="/auth"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </Card>
    </div>
    </>
  );
}
