import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Eye, EyeOff, Loader2, ArrowLeft, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const signUpSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").max(100),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(10, "Please enter a valid phone number").max(20),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["tenant", "admin"]),
  agreedToTerms: z.boolean().refine((val) => val === true, {
    message: "You must agree to the terms and conditions",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showStripeStep, setShowStripeStep] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [isInviteFlow, setIsInviteFlow] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [loadingInviteDetails, setLoadingInviteDetails] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "admin", // Default to admin for regular signup
    agreedToTerms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { signUp, signIn, user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    setIsSignUp(isSignUpRoute);
    
    // Check for invite token in URL
    const searchParams = new URLSearchParams(location.search);
    const token = searchParams.get("invite_token");
    const inviteEmail = searchParams.get("email");
    
    if (token && inviteEmail) {
      setInviteToken(token);
      setIsInviteFlow(true);
      setIsSignUp(true); // Force signup mode
      setFormData(prev => ({
        ...prev,
        email: inviteEmail,
        role: "tenant" // Invite flow still uses tenant role
      }));
      
      // Fetch invite details to get fullName and phone
      setLoadingInviteDetails(true);
      supabase.functions.invoke("get-invite-details", {
        body: { invite_token: token },
      })
        .then(({ data, error }) => {
          if (error) {
            console.error("Error fetching invite details:", error);
            toast({
              title: "Error loading invite",
              description: "Could not load invite details. You can still sign up manually.",
              variant: "destructive",
            });
          } else if (data && !data.error) {
            // Pre-fill fullName and phone from invite
            setFormData(prev => ({
              ...prev,
              fullName: data.full_name || "",
              phone: data.phone || "",
            }));
          }
        })
        .catch((error) => {
          console.error("Error fetching invite details:", error);
        })
        .finally(() => {
          setLoadingInviteDetails(false);
        });
      
      // Clean up URL params
      const newSearchParams = new URLSearchParams(location.search);
      newSearchParams.delete("invite_token");
      newSearchParams.delete("email");
      const newSearch = newSearchParams.toString();
      const newUrl = newSearch ? `${location.pathname}?${newSearch}` : location.pathname;
      window.history.replaceState({}, "", newUrl);
    } else if (isSignUpRoute) {
      // Regular signup route - lock to admin
      setFormData(prev => ({
        ...prev,
        role: "admin"
      }));
    }
  }, [isSignUpRoute, location]);

  // Check if user needs Stripe onboarding after signup
  useEffect(() => {
    // CRITICAL: Check if we just signed out FIRST - before anything else
    // But only block if it's been less than 2 seconds (recent sign out)
    // This allows login to proceed after auto-logout
    const justSignedOut = localStorage.getItem('just_signed_out');
    if (justSignedOut) {
      const signOutTime = parseInt(justSignedOut, 10);
      const timeSinceSignOut = Date.now() - signOutTime;
      const TWO_SECONDS = 2 * 1000;
      
      // Only block redirects if sign out was very recent (within 2 seconds)
      // This prevents blocking legitimate logins after auto-logout
      if (timeSinceSignOut < TWO_SECONDS) {
        console.log("[Auth] Just signed out (recent), preventing redirects");
        return;
      } else {
        // Sign out was more than 2 seconds ago, clear the flag to allow login
        console.log("[Auth] Sign out was more than 2 seconds ago, clearing flag to allow login");
        localStorage.removeItem('just_signed_out');
      }
    }
    
    // Wait for auth to finish loading before redirecting
    if (authLoading) return;
    
    // Only redirect if we're on the auth page (not already redirected)
    if (location.pathname !== "/auth" && location.pathname !== "/signup") {
      return;
    }
    
    // If no user, don't try to redirect
    if (!user) {
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
    
    // If user is logged in AND we didn't just sign out, redirect them IMMEDIATELY
    // Double-check just_signed_out flag to prevent redirect after sign out
    // But only block if sign out was very recent (within 2 seconds)
    const justSignedOutCheck = localStorage.getItem('just_signed_out');
    let shouldBlockRedirect = false;
    if (justSignedOutCheck) {
      const signOutTime = parseInt(justSignedOutCheck, 10);
      const timeSinceSignOut = Date.now() - signOutTime;
      const TWO_SECONDS = 2 * 1000;
      shouldBlockRedirect = timeSinceSignOut < TWO_SECONDS;
      
      if (!shouldBlockRedirect) {
        // Sign out was more than 2 seconds ago, clear the flag
        localStorage.removeItem('just_signed_out');
      }
    }
    
    if (user && !shouldBlockRedirect) {
      if (role) {
        console.log("[Auth] User and role available, redirecting:", { userId: user.id, role });
        if (role === "admin" && stripeOnboarding === "true") {
          setShowStripeStep(true);
        } else if (!showStripeStep) {
          // Force immediate redirect using window.location
          if (role === "admin") {
            console.log("[Auth] Force redirecting to /admin");
            window.location.href = "/admin";
          } else if (role === "tenant") {
            console.log("[Auth] Force redirecting to /tenant");
            window.location.href = "/tenant";
          }
        }
      } else {
        // User logged in but no role - immediately check database and force redirect
        console.log("[Auth] User logged in but no role, checking unit/property assignment");
        const checkAndForceRedirect = async () => {
          try {
            // Race between database checks and timeout - use window.location for instant redirect
            const redirectResult = await Promise.race([
              // Check if assigned to a unit (tenant)
              supabase
                .from('units')
                .select('id')
                .eq('tenant_id', user.id)
                .maybeSingle()
                .then(({ data: unitData }) => {
                  if (unitData) {
                    console.log("[Auth] Found unit, force redirecting to tenant");
                    window.location.href = "/tenant";
                    return "tenant";
                  }
                  return null;
                }),
              // Check if owns properties (admin)
              supabase
                .from('properties')
                .select('id')
                .eq('landlord_id', user.id)
                .maybeSingle()
                .then(({ data: propertyData }) => {
                  if (propertyData) {
                    console.log("[Auth] Found property, force redirecting to admin");
                    window.location.href = "/admin";
                    return "admin";
                  }
                  return null;
                }),
              // Timeout after 1 second - default to tenant
              new Promise((resolve) => {
                setTimeout(() => {
                  console.log("[Auth] Role check timeout, force redirecting to tenant");
                  window.location.href = "/tenant";
                  resolve("timeout");
                }, 1000);
              })
            ]);
            
            // If no redirect happened yet, force it
            if (!redirectResult || redirectResult === "timeout") {
              console.log("[Auth] No role determined, force redirecting to tenant");
              window.location.href = "/tenant";
            }
          } catch (error) {
            console.error("[Auth] Error checking role, force redirecting to tenant:", error);
            window.location.href = "/tenant";
          }
        };
        checkAndForceRedirect();
      }
    }
    // Don't try to fetch role here - let useAuth handle it
    // The ProtectedRoute will handle waiting for the role
  }, [user, role, navigate, stripeOnboarding, showStripeStep, authLoading, location.pathname]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  // Check if form is valid for signup
  const isSignUpFormValid = () => {
    if (!isSignUp) return true; // Sign in form doesn't need this validation
    
    // Check all required fields are filled
    if (!formData.fullName.trim()) return false;
    if (!formData.email.trim()) return false;
    if (!formData.phone.trim()) return false;
    if (!formData.password.trim()) return false;
    if (!formData.confirmPassword.trim()) return false;
    if (!formData.agreedToTerms) return false; // Terms must be agreed to
    
    // Validate using schema
    const result = signUpSchema.safeParse(formData);
    return result.success;
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
          const newUser = signUpResult.data.user;
          
          // If this is an invite flow, auto-confirm and login
          if (isInviteFlow && inviteToken && newUser.id) {
            try {
              // Call confirm-tenant-account edge function
              const { data: confirmData, error: confirmError } = await supabase.functions.invoke(
                "confirm-tenant-account",
                {
                  body: {
                    user_id: newUser.id,
                    invite_token: inviteToken,
                  },
                }
              );

              if (confirmError || confirmData?.error) {
                console.error("Error confirming account:", confirmError || confirmData?.error);
                toast({
                  title: "Account created!",
                  description: "Please check your email to confirm your account.",
                });
                // Fallback: user can still confirm via email
                setLoading(false);
                return;
              }

              // Account confirmed, now sign in the user
              toast({
                title: "Account created and confirmed!",
                description: "Signing you in...",
              });

              // Wait a moment for the confirmation to propagate
              await new Promise(resolve => setTimeout(resolve, 1000));

              // Sign in the user
              const { error: signInError } = await signIn(formData.email, formData.password);
              
              if (signInError) {
                console.error("Error signing in after confirmation:", signInError);
                toast({
                  title: "Account confirmed!",
                  description: "Please sign in with your credentials.",
                });
                setLoading(false);
                return;
              }

              // Success - user will be redirected by the auth flow
              toast({
                title: "Welcome!",
                description: "Your account has been created and you're signed in.",
              });
              
              // Force redirect to tenant dashboard
              setTimeout(() => {
                window.location.href = "/tenant";
              }, 500);
              
              return;
            } catch (error: any) {
              console.error("Error in invite flow:", error);
              toast({
                title: "Account created!",
                description: "Please check your email to confirm your account.",
              });
              setLoading(false);
              return;
            }
          }
          
          // Auto-confirm all new signups (not just invited tenants)
          if (newUser.id && !isInviteFlow) {
            try {
              // Call manually-confirm-user edge function to auto-confirm
              const { data: confirmData, error: confirmError } = await supabase.functions.invoke(
                "manually-confirm-user",
                {
                  body: {
                    user_id: newUser.id,
                  },
                }
              );

              if (confirmError || confirmData?.error) {
                console.error("Error auto-confirming account:", confirmError || confirmData?.error);
                // Continue anyway - user can confirm via email if needed
              } else {
                console.log("Account auto-confirmed successfully");
              }
            } catch (error: any) {
              console.error("Error in auto-confirm flow:", error);
              // Continue anyway - user can confirm via email if needed
            }
          }
          
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

        // Clear just_signed_out flag BEFORE attempting login to prevent redirect blocking
        localStorage.removeItem('just_signed_out');
        
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
          // Login successful - wait for session to be established before redirecting
          console.log("[Auth] Login successful, waiting for session to be established");
          
          // Show toast briefly
          toast({
            title: "Login successful",
            description: "Redirecting...",
          });
          
          // Wait for session to be established and auth state to update
          const waitForSessionAndRedirect = async () => {
            try {
              // Wait for session to be available (with timeout)
              let attempts = 0;
              const maxAttempts = 20; // 2 seconds max wait
              
              while (attempts < maxAttempts) {
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                
                if (currentSession?.user) {
                  console.log("[Auth] Session established, proceeding with redirect");
                  
                  // Wait a tiny bit more for React state to update
                  await new Promise(resolve => setTimeout(resolve, 200));
                  
                  // Get current user from session
                  const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
              
                  if (userError) {
                    console.error("[Auth] Error getting user:", userError);
                    // Fallback: redirect to tenant
                    window.location.href = "/tenant";
                    return;
                  }
                  
                  if (currentUser) {
                    // Try quick database check with timeout
                    const redirectPromise = Promise.race([
                      // Check if assigned to a unit (tenant)
                      supabase
                        .from('units')
                        .select('id')
                        .eq('tenant_id', currentUser.id)
                        .maybeSingle()
                        .then(({ data: unitData }) => {
                          if (unitData) {
                            console.log("[Auth] Found unit assignment, redirecting to tenant");
                            window.location.href = "/tenant";
                            return "tenant";
                          }
                          return null;
                        }),
                      // Check if owns properties (admin)
                      supabase
                        .from('properties')
                        .select('id')
                        .eq('landlord_id', currentUser.id)
                        .maybeSingle()
                        .then(({ data: propertyData }) => {
                          if (propertyData) {
                            console.log("[Auth] Found property ownership, redirecting to admin");
                            window.location.href = "/admin";
                            return "admin";
                          }
                          return null;
                        }),
                      // Timeout after 500ms - default to tenant (faster timeout)
                      new Promise(resolve => setTimeout(() => {
                        console.log("[Auth] Timeout reached, defaulting to tenant redirect");
                        window.location.href = "/tenant";
                        resolve("timeout");
                      }, 500))
                    ]);
                    
                    await redirectPromise;
                    return; // Success, exit function
                  }
                }
                
                // Session not ready yet, wait and retry
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              
              // If we get here, session never established - fallback redirect
              console.log("[Auth] Session not established after max attempts, redirecting to tenant");
              window.location.href = "/tenant";
            } catch (error) {
              console.error("[Auth] Error in waitForSessionAndRedirect:", error);
              // Fallback redirect
              window.location.href = "/tenant";
            }
          };
          
          // If we already have role, redirect immediately
          if (role === "admin") {
            console.log("[Auth] Role is admin, redirecting immediately");
            window.location.href = "/admin";
          } else if (role === "tenant") {
            console.log("[Auth] Role is tenant, redirecting immediately");
            window.location.href = "/tenant";
          } else {
            // No role yet - wait for session and check database
            waitForSessionAndRedirect().catch(err => {
              console.error("[Auth] Redirect error:", err);
              window.location.href = "/tenant";
            });
          }
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
        <meta name="robots" content="noindex, nofollow" />
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
                  Full Name <span className="text-destructive">*</span>
                </Label>
                {isInviteFlow && (
                  <p className="text-sm text-muted-foreground mb-2">
                    Your name was provided by your landlord and cannot be changed.
                  </p>
                )}
                <Input
                  id="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange("fullName", e.target.value)}
                  disabled={isInviteFlow}
                  className={`h-12 bg-background border-border/60 rounded-xl focus:border-primary ${isInviteFlow ? 'opacity-60 cursor-not-allowed' : ''}`}
                  placeholder="John Doe"
                  required
                />
                {errors.fullName && (
                  <p className="text-destructive text-sm">{errors.fullName}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground font-medium">
                Email <span className="text-destructive">*</span>
              </Label>
              {isInviteFlow && (
                <p className="text-sm text-muted-foreground mb-2">
                  You've been invited to join as a tenant. Your email is pre-filled.
                </p>
              )}
              <Input
                id="email"
                type="email"
                disabled={isInviteFlow}
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className={`h-12 bg-background border-border/60 rounded-xl focus:border-primary ${isInviteFlow ? 'opacity-60 cursor-not-allowed' : ''}`}
                placeholder="you@example.com"
                required
              />
              {errors.email && (
                <p className="text-destructive text-sm">{errors.email}</p>
              )}
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-foreground font-medium">
                  Phone <span className="text-destructive">*</span>
                </Label>
                {isInviteFlow && formData.phone && (
                  <p className="text-sm text-muted-foreground mb-2">
                    Your phone number was provided by your landlord and cannot be changed.
                  </p>
                )}
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  disabled={isInviteFlow}
                  className={`h-12 bg-background border-border/60 rounded-xl focus:border-primary ${isInviteFlow ? 'opacity-60 cursor-not-allowed' : ''}`}
                  placeholder="(555) 123-4567"
                  required
                />
                {errors.phone && (
                  <p className="text-destructive text-sm">{errors.phone}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-medium">
                Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  className="h-12 bg-background border-border/60 rounded-xl focus:border-primary pr-12"
                  placeholder="••••••••"
                  required
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
                <Label htmlFor="confirmPassword" className="text-foreground font-medium">
                  Confirm Password <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    className="h-12 bg-background border-border/60 rounded-xl focus:border-primary pr-12"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-destructive text-sm">{errors.confirmPassword}</p>
                )}
              </div>
            )}

            {isSignUp && isInviteFlow && (
              <div className="space-y-2">
                <Label htmlFor="role" className="text-foreground font-medium">
                  Role
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  You've been invited as a tenant.
                </p>
                <Select
                  value={formData.role}
                  onValueChange={(value) => handleInputChange("role", value)}
                  disabled={true}
                >
                  <SelectTrigger className="h-12 bg-background border-border/60 rounded-xl focus:border-primary opacity-60 cursor-not-allowed">
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

            {isSignUp && !isInviteFlow && (
              <div className="space-y-2 mt-2">
                <p className="text-center text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Sign up is for Landlords only.</span>{" "}
                  Tenants will be invited by their landlord.
                </p>
                <p className="text-center text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">One profile, multiple properties.</span>{" "}
                  Create a single account to manage all your rental properties.
                </p>
              </div>
            )}

            {isSignUp && (
              <div className="space-y-4 mt-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="agreedToTerms"
                    checked={formData.agreedToTerms}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, agreedToTerms: checked === true }))
                    }
                    className="mt-1"
                  />
                  <Label 
                    htmlFor="agreedToTerms" 
                    className="text-sm text-foreground cursor-pointer leading-relaxed"
                  >
                    I agree to the{" "}
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="text-primary hover:underline font-medium"
                    >
                      Terms and Conditions
                    </button>
                    <span className="text-destructive"> *</span>
                  </Label>
                </div>
                {errors.agreedToTerms && (
                  <p className="text-destructive text-sm">{errors.agreedToTerms}</p>
                )}
                
                <p className="text-center text-sm text-muted-foreground">
                  Have any questions before signing up? Email us at{" "}
                  <a 
                    href="mailto:support@payrentflow.com" 
                    className="text-primary hover:underline font-medium"
                  >
                    support@payrentflow.com
                  </a>
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || (isSignUp && !isSignUpFormValid())}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold text-base mt-6 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Terms and Conditions Modal */}
      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Terms and Conditions</DialogTitle>
            <DialogDescription>
              Please read and accept our terms and conditions to continue.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 text-sm text-foreground">
              <div>
                <h3 className="font-semibold text-base mb-2">1. Account Requirements</h3>
                <p className="text-muted-foreground">
                  By creating an account with RentFlow, you agree to maintain an active account with at least one active tenant. 
                  An active tenant is defined as a tenant who is currently assigned to a unit and has an active rental agreement.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-base mb-2">2. Monthly Service Fee</h3>
                <p className="text-muted-foreground">
                  If your account does not have at least one active tenant at any point during a billing cycle, you will be 
                  charged a monthly service fee of $50.00 USD. This fee will be automatically charged to your payment method 
                  on file at the beginning of each month in which your account does not meet the active tenant requirement.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-base mb-2">3. Account Activity</h3>
                <p className="text-muted-foreground">
                  You are responsible for maintaining accurate tenant information and ensuring that your account reflects 
                  current rental agreements. RentFlow reserves the right to verify account activity and tenant status at any time.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-base mb-2">4. Payment Processing</h3>
                <p className="text-muted-foreground">
                  All fees will be processed through our secure payment system. You agree to maintain a valid payment method 
                  on file and authorize RentFlow to charge applicable fees as described in these terms.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-base mb-2">5. Service Availability</h3>
                <p className="text-muted-foreground">
                  RentFlow provides property management and rent collection services. You agree to use the service in 
                  accordance with all applicable laws and regulations. RentFlow reserves the right to modify or discontinue 
                  services with reasonable notice.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-base mb-2">6. Data and Privacy</h3>
                <p className="text-muted-foreground">
                  Your data is securely stored and processed in accordance with our Privacy Policy. You retain ownership 
                  of all data you provide and can request deletion of your account and data at any time.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-base mb-2">7. Limitation of Liability</h3>
                <p className="text-muted-foreground">
                  RentFlow provides the service "as is" and makes no warranties regarding uninterrupted or error-free service. 
                  Our liability is limited to the amount of fees paid in the previous 12 months.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-base mb-2">8. Changes to Terms</h3>
                <p className="text-muted-foreground">
                  RentFlow reserves the right to modify these terms at any time. Material changes will be communicated via 
                  email or through the service. Continued use of the service after changes constitutes acceptance of the new terms.
                </p>
              </div>

              <div className="pt-4 border-t">
                <p className="text-muted-foreground">
                  By checking the "I agree to the Terms and Conditions" checkbox, you acknowledge that you have read, 
                  understood, and agree to be bound by these terms and conditions.
                </p>
              </div>
            </div>
          </ScrollArea>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowTermsModal(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
