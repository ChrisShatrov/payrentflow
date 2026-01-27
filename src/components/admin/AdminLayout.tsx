import { ReactNode, useState } from "react";
import { Helmet } from "react-helmet-async";
import { AdminSidebar } from "./AdminSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen flex bg-muted/30">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <AdminSidebar />
        </div>

        {/* Mobile Header with Hamburger Menu */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
          <div className="flex items-center justify-between px-4 h-16">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="RentFlow" className="w-10 h-10" />
              <div className="flex flex-col">
                <h1 className="text-2xl font-extrabold tracking-tight">
                  <span className="text-primary">Rent</span>
                  <span className="text-foreground">Flow</span>
                </h1>
                <p className="text-xs text-muted-foreground">Admin Portal</p>
              </div>
            </div>
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[400px] p-0">
                <AdminSidebar onItemClick={() => setMenuOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-auto md:ml-0 pt-16 md:pt-0">
          {children}
        </main>
      </div>
    </>
  );
}
