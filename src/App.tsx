import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { supabase } from "@/integrations/supabase/client";
import { lazy, Suspense } from "react";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

// Lazy load routes for code splitting (improves Core Web Vitals)
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminProperties = lazy(() => import("./pages/admin/AdminProperties"));
const AdminTenants = lazy(() => import("./pages/admin/AdminTenants"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments"));
const AdminStatements = lazy(() => import("./pages/admin/AdminStatements"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const TenantDashboard = lazy(() => import("./pages/tenant/TenantDashboard"));
const TenantStatements = lazy(() => import("./pages/tenant/TenantStatements"));
const TenantPayments = lazy(() => import("./pages/tenant/TenantPayments"));

// Resources & Blog
const Resources = lazy(() => import("./pages/Resources"));
const HowToCollectRentOnline = lazy(() => import("./pages/blog/HowToCollectRentOnline"));
const AreOnlineRentPaymentsSafe = lazy(() => import("./pages/blog/AreOnlineRentPaymentsSafe"));
const HowToAutomateLateFees = lazy(() => import("./pages/blog/HowToAutomateLateFees"));

// SEO Landing Pages - Lazy loaded for code splitting
const PayRentOnline = lazy(() => import("./pages/SEOPages").then(m => ({ default: m.PayRentOnline })));
const RentPaymentApp = lazy(() => import("./pages/SEOPages").then(m => ({ default: m.RentPaymentApp })));
const PayRentWithCreditCard = lazy(() => import("./pages/SEOPages").then(m => ({ default: m.PayRentWithCreditCard })));
const PayRentWithDebitCard = lazy(() => import("./pages/SEOPages").then(m => ({ default: m.PayRentWithDebitCard })));
const PayRentWithACH = lazy(() => import("./pages/SEOPages").then(m => ({ default: m.PayRentWithACH })));
const PropertyManagementSoftware = lazy(() => import("./pages/SEOPages").then(m => ({ default: m.PropertyManagementSoftware })));
const RentCollectionSoftware = lazy(() => import("./pages/SEOPages").then(m => ({ default: m.RentCollectionSoftware })));
const TenantManagementSoftware = lazy(() => import("./pages/SEOPages").then(m => ({ default: m.TenantManagementSoftware })));
const LateFeeAutomation = lazy(() => import("./pages/SEOPages").then(m => ({ default: m.LateFeeAutomation })));
const Pricing = lazy(() => import("./pages/SEOPages").then(m => ({ default: m.Pricing })));
const Features = lazy(() => import("./pages/SEOPages").then(m => ({ default: m.Features })));
const HowItWorks = lazy(() => import("./pages/SEOPages").then(m => ({ default: m.HowItWorks })));
const Security = lazy(() => import("./pages/SEOPages").then(m => ({ default: m.Security })));
const Contact = lazy(() => import("./pages/SEOPages").then(m => ({ default: m.Contact })));
const About = lazy(() => import("./pages/SEOPages").then(m => ({ default: m.About })));

const queryClient = new QueryClient();

// Role-based redirect component for the root path
function RoleBasedRedirect() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Don't redirect if we're already on /auth or /signup or /reset-password
    const currentPath = window.location.pathname;
    if (currentPath === "/auth" || currentPath === "/signup" || currentPath === "/reset-password") {
      return;
    }
    
    // Don't redirect if we just signed out (check localStorage)
    const justSignedOut = localStorage.getItem('just_signed_out');
    if (justSignedOut) {
      localStorage.removeItem('just_signed_out');
      // Don't redirect - let user stay on auth page
      return;
    }

    // Check if this is a password recovery session - if so, redirect to reset-password page
    // Supabase puts recovery tokens in the URL hash after redirecting
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);
    const type = hashParams.get("type") || searchParams.get("type");
    const accessToken = hashParams.get("access_token") || searchParams.get("access_token");
    
    // Only redirect to reset-password if it's explicitly a recovery token
    // Signup confirmations should not go to reset-password
    if (type === "recovery") {
      console.log("[RoleBasedRedirect] Recovery session detected, redirecting to /reset-password", { type, hasToken: !!accessToken });
      // Preserve the hash when redirecting so ResetPassword can extract the token
      const hash = window.location.hash;
      navigate(`/reset-password${hash}`, { replace: true });
      return;
    }
    
    // If it's a signup confirmation, ensure Supabase processes it
    // Supabase will automatically set the session when the user clicks the confirmation link
    if (type === "signup" && accessToken) {
      console.log("[RoleBasedRedirect] Signup confirmation detected");
      
      // Handle signup confirmation asynchronously
      const handleSignupConfirmation = async () => {
        // Check if session is already set (Supabase might have already processed it)
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (!existingSession) {
          console.log("[RoleBasedRedirect] Setting signup session");
          // Set the session explicitly to ensure Supabase processes the signup confirmation
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: hashParams.get("refresh_token") || searchParams.get("refresh_token") || "",
          });
          
          if (error) {
            console.error("[RoleBasedRedirect] Error setting signup session:", error);
          } else if (data.session) {
            console.log("[RoleBasedRedirect] Signup session set successfully");
          }
        } else {
          console.log("[RoleBasedRedirect] Session already exists, Supabase processed signup");
        }
        
        // Clear the URL hash/search params
        window.history.replaceState({}, document.title, "/");
      };
      
      handleSignupConfirmation();
      // Don't redirect yet - wait for session to be set, then normal flow will handle it
      return;
    }

    if (!loading && user) {
      if (role) {
        // User and role are both available - redirect immediately
        if (role === "admin") {
          navigate("/admin", { replace: true });
        } else if (role === "tenant") {
          navigate("/tenant", { replace: true });
        }
      } else {
        // User is logged in but role isn't loaded - try to determine from unit/property
        const determineAndRedirect = async () => {
          // Check if assigned to a unit (tenant)
          const { data: unitData } = await supabase
            .from('units')
            .select('id')
            .eq('tenant_id', user.id)
            .maybeSingle();
          
          if (unitData) {
            console.log("[RoleBasedRedirect] User is assigned to a unit, redirecting to tenant");
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
            console.log("[RoleBasedRedirect] User owns properties, redirecting to admin");
            navigate("/admin", { replace: true });
            return;
          }
          
          // Default to tenant if we can't determine
          console.log("[RoleBasedRedirect] Cannot determine role, defaulting to tenant");
          navigate("/tenant", { replace: true });
        };
        determineAndRedirect();
      }
    }
  }, [user, role, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Index />;
  }

  // Show loading while determining redirect (useEffect will handle it)
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

// Component to handle inactivity logout
const InactivityHandler = () => {
  useInactivityLogout();
  return null;
};

// Loading component for lazy-loaded routes
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const AppRoutes = () => {
  // Initialize inactivity logout handler
  return (
    <>
      <InactivityHandler />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<RoleBasedRedirect />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/signup" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* SEO Landing Pages - Tenant Intent (High Volume) */}
        <Route path="/pay-rent-online" element={<PayRentOnline />} />
        <Route path="/rent-payment-app" element={<RentPaymentApp />} />
        <Route path="/pay-rent-with-credit-card" element={<PayRentWithCreditCard />} />
        <Route path="/pay-rent-with-debit-card" element={<PayRentWithDebitCard />} />
        <Route path="/pay-rent-with-ach" element={<PayRentWithACH />} />
        <Route path="/bank-transfer-rent-payment" element={<PayRentWithACH />} />
        
        {/* SEO Landing Pages - Landlord/Manager Intent (Higher Buying Intent) */}
        <Route path="/property-management-software" element={<PropertyManagementSoftware />} />
        <Route path="/rent-collection-software" element={<RentCollectionSoftware />} />
        <Route path="/tenant-management-software" element={<TenantManagementSoftware />} />
        <Route path="/late-fee-automation" element={<LateFeeAutomation />} />
        
        {/* SEO Landing Pages - Trust + Conversion */}
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/features" element={<Features />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/security" element={<Security />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/about" element={<About />} />
        
        {/* Resources & Blog */}
        <Route path="/resources" element={<Resources />} />
        <Route path="/resources/how-to-collect-rent-online-ach-vs-card" element={<HowToCollectRentOnline />} />
        <Route path="/resources/are-online-rent-payments-safe" element={<AreOnlineRentPaymentsSafe />} />
        <Route path="/resources/how-to-automate-late-fees-legally" element={<HowToAutomateLateFees />} />
        
        {/* Admin Routes - Only accessible by admins */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/properties" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminProperties />
          </ProtectedRoute>
        } />
        <Route path="/admin/tenants" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminTenants />
          </ProtectedRoute>
        } />
        <Route path="/admin/payments" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminPayments />
          </ProtectedRoute>
        } />
        <Route path="/admin/statements" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminStatements />
          </ProtectedRoute>
        } />
        <Route path="/admin/settings" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminSettings />
          </ProtectedRoute>
        } />
        
        {/* Tenant Routes - Only accessible by tenants */}
        <Route path="/tenant" element={
          <ProtectedRoute allowedRoles={["tenant"]}>
            <TenantDashboard />
          </ProtectedRoute>
        } />
        <Route path="/tenant/payments" element={
          <ProtectedRoute allowedRoles={["tenant"]}>
            <TenantPayments />
          </ProtectedRoute>
        } />
        <Route path="/tenant/statements" element={
          <ProtectedRoute allowedRoles={["tenant"]}>
            <TenantStatements />
          </ProtectedRoute>
        } />
        
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
};

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
