import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ("admin" | "tenant")[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading, role } = useAuth();
  const location = useLocation();

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Not logged in - redirect to auth
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If specific roles are required, check them
  // But allow access even if role is null (user might not have role set yet)
  if (allowedRoles) {
    // If we have a role and it's not allowed, redirect
    if (role && !allowedRoles.includes(role)) {
      // Redirect to appropriate dashboard based on role
      if (role === "admin") {
        return <Navigate to="/admin" replace />;
      } else if (role === "tenant") {
        return <Navigate to="/tenant" replace />;
      }
    }
    // If role is null, still allow access - let the component handle missing role gracefully
  }

  return <>{children}</>;
}
