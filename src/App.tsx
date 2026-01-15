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
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProperties from "./pages/admin/AdminProperties";
import AdminTenants from "./pages/admin/AdminTenants";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminStatements from "./pages/admin/AdminStatements";
import AdminSettings from "./pages/admin/AdminSettings";
import TenantDashboard from "./pages/tenant/TenantDashboard";
import TenantStatements from "./pages/tenant/TenantStatements";
import TenantPayments from "./pages/tenant/TenantPayments";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

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

const AppRoutes = () => {
  // Initialize inactivity logout handler
  return (
    <>
      <InactivityHandler />
      <Routes>
        <Route path="/" element={<RoleBasedRedirect />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/signup" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
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
