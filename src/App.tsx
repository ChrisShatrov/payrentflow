import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProperties from "./pages/admin/AdminProperties";
import AdminTenants from "./pages/admin/AdminTenants";
import AdminStatements from "./pages/admin/AdminStatements";
import TenantDashboard from "./pages/tenant/TenantDashboard";
import TenantStatements from "./pages/tenant/TenantStatements";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

const queryClient = new QueryClient();

// Role-based redirect component for the root path
function RoleBasedRedirect() {
  const { user, role, loading } = useAuth();

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

  // Redirect based on role
  if (role === "admin") {
    return <Navigate to="/admin" replace />;
  } else if (role === "tenant") {
    return <Navigate to="/tenant" replace />;
  }

  // Default to index if no role set yet
  return <Index />;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<RoleBasedRedirect />} />
    <Route path="/auth" element={<Auth />} />
    
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
    <Route path="/admin/statements" element={
      <ProtectedRoute allowedRoles={["admin"]}>
        <AdminStatements />
      </ProtectedRoute>
    } />
    
    {/* Tenant Routes - Only accessible by tenants */}
    <Route path="/tenant" element={
      <ProtectedRoute allowedRoles={["tenant"]}>
        <TenantDashboard />
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
);

const App = () => (
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
);

export default App;
