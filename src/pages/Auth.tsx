import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Eye, EyeOff, Loader2, ArrowLeft, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const signUpSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(10, "Please enter a valid phone number").max(20),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["tenant", "admin"]),
});

const signInSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export default function Auth() {
  const location = useLocation();
  const stripeOnboarding = new URLSearchParams(location.search).get("stripe_onboarding");
  // Determine if signup based on route path
  const isSignUpRoute = location.pathname === "/signup";
  const [isSignUp, setIsSignUp] = useState(isSignUpRoute);
  
  const pageTitle = isSignUp ? "Sign Up — RentFlow" : "Sign In — RentFlow";
  const pageDescription = isSignUp 
    ? "Create your RentFlow account to start managing properties and collecting rent online. Free to get started."
    : "Sign in to your RentFlow account to manage properties, track payments, and collect rent online.";
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showStripeStep, setShowStripeStep] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    role: "tenant",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { signUp, signIn, user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    setIsSignUp(isSignUpRoute);
  }, [isSignUpRoute]);

  // Check if user needs Stripe onboarding after signup
  useEffect(() => {
    // Wait for auth to finish loading before redirecting
    if (authLoading) return;
    
    // Only redirect if we're on the auth page (not already redirected)
    if (location.pathname !== "/auth" && location.pathname !== "/signup") {
      return;
    }
    
    // Don't redirect if we just signed out
    const justSignedOut = localStorage.getItem('just_signed_out');
    if (justSignedOut) {
      localStorage.removeItem('just_signed_out');
      // Don't redirect - let user stay on auth page
      return;
    }
    
    // Check if this is a password recovery session - if so, redirect to reset-password page
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);
    const isRecovery = hashParams.get("type") === "recovery" || searchParams.get("type") === "recovery";
    
    if (isRecovery) {
      console.log("[Auth] Recovery session detected, redirecting to /reset-password");
      navigate("/reset-password", { replace: true });
      return;
    }
    
    // If user is logged in, redirect them (even if role is null, we'll handle it in ProtectedRoute)
    if (user) {
      if (role) {
        console.log("[Auth] User and role available, redirecting:", { userId: user.id, role });
        if (role === "admin" && stripeOnboarding === "true") {
          setShowStripeStep(true);
        } else if (!showStripeStep) {
          // Redirect based on role
          if (role === "admin") {
            console.log("[Auth] Redirecting to /admin");
            navigate("/admin", { replace: true });
          } else if (role === "tenant") {
            console.log("[Auth] Redirecting to /tenant");
            navigate("/tenant", { replace: true });
          }
        }
      } else {
        // User logged in but no role - try to determine role from unit/property assignment
        console.log("[Auth] User logged in but no role, checking unit/property assignment");
        const checkAndRedirect = async () => {
          // Check if assigned to a unit (tenant)
          const { data: unitData } = await supabase
            .from('units')
            .select('id')
            .eq('tenant_id', user.id)
            .maybeSingle();
          
          if (unitData) {
            console.log("[Auth] User is assigned to a unit, redirecting to tenant dashboard");
            navigate("/tenant", { replace: true });
            return;
          }
          
          // Check if owns properties (admin)
          const { data: propertyData } = await supabase
            .from('properties')
            .select('id')
            .eq('landlord_id', user.id)
            .maybeSingle();
          
          if (propertyData) {
            console.log("[Auth] User owns properties, redirecting to admin dashboard");
            navigate("/admin", { replace: true });
            return;
          }
          
          // Default to tenant if we can't determine
          console.log("[Auth] Cannot determine role, defaulting to tenant dashboard");
          navigate("/tenant", { replace: true });
        };
        checkAndRedirect();
      }
    }
    // Don't try to fetch role here - let useAuth handle it
    // The ProtectedRoute will handle waiting for the role
  }, [user, role, navigate, stripeOnboarding, showStripeStep, authLoading, location.pathname]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      if (isSignUp) {
        const result = signUpSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((err) => {
            if (err.path[0]) {
              fieldErrors[err.path[0] as string] = err.message;
            }
          });
          setErrors(fieldErrors);
          setLoading(false);
          return;
        }

        // Note: We don't check if user exists here because:
        // 1. Invited users might have a profile but no auth account yet (they need to sign up)
        // 2. Supabase will return an error if auth account already exists
        // We'll handle the error from Supabase instead

        const signUpResult = await signUp(
          formData.email,
          formData.password,
          formData.fullName,
          formData.phone,
          formData.role
        );

        if (signUpResult.error) {
          // Check for various "user already exists" error messages
          const errorMsg = signUpResult.error.message.toLowerCase();
          if (errorMsg.includes("already registered") || 
              errorMsg.includes("user already registered") ||
              errorMsg.includes("already exists") ||
              errorMsg.includes("email address is already")) {
            toast({
              title: "Account already exists",
              description: "This email is already registered. Please sign in instead.",
              variant: "destructive",
            });
            // Switch to login form after a moment
            setTimeout(() => {
              navigate("/auth", { replace: true });
            }, 2000);
          } else {
            toast({
              title: "Sign up failed",
              description: signUpResult.error.message,
              variant: "destructive",
            });
          }
        } else if (signUpResult.data?.user) {
          // If landlord, show Stripe onboarding step
          if (formData.role === "admin") {
            toast({
              title: "Account created!",
              description: "Now let's set up your payment account.",
            });
            // Wait for auth state to update and user to be available, then show Stripe step
            const checkUserAndShowStripe = () => {
              if (user && role === "admin") {
                setShowStripeStep(true);
              } else {
                // Check again after a short delay
                setTimeout(checkUserAndShowStripe, 500);
              }
            };
            // Start checking after a brief delay
            setTimeout(checkUserAndShowStripe, 1000);
          } else {
            toast({
              title: "Account created!",
              description: "Please check your email to confirm your account.",
            });
          }
        }
      } else {
        const result = signInSchema.safeParse(formData);
        if (!result.success) {
          const fieldErrors: Record<string, string> = {};
          result.error.errors.forEach((err) => {
            if (err.path[0]) {
              fieldErrors[err.path[0] as string] = err.message;
            }
          });
          setErrors(fieldErrors);
          setLoading(false);
          return;
        }

        const { error } = await signIn(formData.email, formData.password);

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Invalid credentials",
              description: "The email or password you entered is incorrect.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Sign in failed",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          // Login successful - the useEffect will handle redirect once role is loaded
          toast({
            title: "Login successful",
            description: "Redirecting to your dashboard...",
          });
          // Don't manually redirect here - let the useEffect and ProtectedRoute handle it
        }
      }
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStripeConnect = async () => {
    setStripeLoading(true);
    try {
      // Ensure user is available
      if (!user) {
        throw new Error("Please sign in first. If you just signed up, please wait a moment and try again.");
      }

      // Ensure we have a valid session before calling the function
      let { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        // Wait a moment and try again (session might still be establishing after signup)
        await new Promise(resolve => setTimeout(resolve, 1000));
        const retryResult = await supabase.auth.getSession();
        session = retryResult.data.session;
        sessionError = retryResult.error;
        
        if (sessionError || !session) {
          throw new Error("Please sign in first. If you just signed up, please wait a moment and try again.");
        }
      }

      console.log("[Auth] Calling create-connect-account with user:", user.id, "session:", !!session);

      // The supabase client should automatically include the Authorization header
      const { data, error } = await supabase.functions.invoke("create-connect-account");
      
      if (error) {
        console.error("[Auth] Function invocation error:", error);
        throw error;
      }
      if (data?.error) {
        console.error("[Auth] Function returned error:", data.error);
        throw new Error(data.error);
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Stripe Connect error:", error);
      toast({
        title: "Setup Failed",
        description: error instanceof Error ? error.message : "Unable to set up payment account. You can do this later from settings.",
        variant: "destructive",
      });
    } finally {
      setStripeLoading(false);
    }
  };

  const skipStripeSetup = () => {
    toast({
      title: "Skipped for now",
      description: "You can set up your payment account later from your dashboard.",
    });
    navigate("/admin");
  };

  // Stripe onboarding step for landlords
  if (showStripeStep) {
    return (
      <div className="min-h-screen bg-primary/5 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-2xl shadow-card p-8 border border-border/50 animate-fade-in">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CreditCard className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Set Up Payments
              </h1>
              <p className="text-muted-foreground">
                Connect your bank account to receive rent payments from tenants.
              </p>
            </div>

            <div className="space-y-4">
              <Button
                onClick={handleStripeConnect}
                disabled={stripeLoading}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold text-base"
              >
                {stripeLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={20} />
                    Setting up...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2" size={20} />
                    Connect with Stripe
                  </>
                )}
              </Button>

              <Button
                onClick={skipStripeSetup}
                variant="ghost"
                className="w-full h-12 text-muted-foreground hover:text-foreground"
              >
                Skip for now
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground mt-6">
              Powered by Stripe. Your financial data is securely handled.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={`https://www.payrentflow.com${location.pathname}`} />
      </Helmet>
      <div className="min-h-screen bg-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back to home link */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="bg-card rounded-2xl shadow-card p-8 border border-border/50 animate-fade-in">
          {/* Logo */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="text-primary">Rent</span>
              <span className="text-foreground">Flow</span>
            </h1>
            <p className="text-muted-foreground mt-2">Pay Rent, Stress-Free.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-foreground font-medium">
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange("fullName", e.target.value)}
                  className="h-12 bg-background border-border/60 rounded-xl focus:border-primary"
                  placeholder="John Doe"
                />
                {errors.fullName && (
                  <p className="text-destructive text-sm">{errors.fullName}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="h-12 bg-background border-border/60 rounded-xl focus:border-primary"
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="text-destructive text-sm">{errors.email}</p>
              )}
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-foreground font-medium">
                  Phone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  className="h-12 bg-background border-border/60 rounded-xl focus:border-primary"
                  placeholder="(555) 123-4567"
                />
                {errors.phone && (
                  <p className="text-destructive text-sm">{errors.phone}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  className="h-12 bg-background border-border/60 rounded-xl focus:border-primary pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-destructive text-sm">{errors.password}</p>
              )}
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="role" className="text-foreground font-medium">
                  Role
                </Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleInputChange("role", value)}
                >
                  <SelectTrigger className="h-12 bg-background border-border/60 rounded-xl focus:border-primary">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tenant">Tenant</SelectItem>
                    <SelectItem value="admin">Landlord / Admin</SelectItem>
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-destructive text-sm">{errors.role}</p>
                )}
              </div>
            )}

            {isSignUp && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                Have any questions before signing up? Email us at{" "}
                <a 
                  href="mailto:support@payrentflow.com" 
                  className="text-primary hover:underline font-medium"
                >
                  support@payrentflow.com
                </a>
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold text-base mt-6 transition-all duration-200"
            >
              {loading ? (
                <Loader2 className="animate-spin mr-2" size={20} />
              ) : null}
              {isSignUp ? "Sign Up" : "Login"}
            </Button>
          </form>

          <p className="text-center text-muted-foreground mt-6 hidden">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <Link
              to={isSignUp ? "/auth" : "/signup"}
              onClick={() => setErrors({})}
              className="text-primary font-medium hover:underline"
            >
              {isSignUp ? "Login" : "Sign Up"}
            </Link>
          </p>
        </div>
      </div>
      </div>
    </>
  );
}
