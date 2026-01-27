import { ReactNode, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, FileText, Settings, LogOut, User, CreditCard, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NotificationsDropdown } from "./NotificationsDropdown";

interface TenantLayoutProps {
  children: ReactNode;
  onOpenSettings?: () => void;
}

const navItems = [
  { label: "Dashboard", href: "/tenant", icon: Home },
  { label: "Payments", href: "/tenant/payments", icon: CreditCard },
  { label: "Statements", href: "/tenant/statements", icon: FileText },
];

export function TenantLayout({ children, onOpenSettings }: TenantLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/tenant" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="RentFlow" className="w-12 h-12" />
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="text-primary">Rent</span>
              <span className="text-foreground">Flow</span>
            </h1>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right section */}
          <div className="flex items-center gap-3">
            <NotificationsDropdown />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    {user?.email?.charAt(0).toUpperCase() || "U"}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem 
                  onClick={() => {
                    if (onOpenSettings) {
                      onOpenSettings();
                    } else {
                      // Fallback: navigate to dashboard where settings modal can be opened
                      navigate("/tenant");
                    }
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <User className="h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={async () => {
                    // Mark that we're signing out to prevent redirect loops
                    // Use localStorage so it persists across page reload
                    localStorage.setItem('just_signed_out', Date.now().toString());
                    await signOut();
                    // Use window.location.href to force a full page reload and clear all state
                    window.location.href = "/auth";
                  }} 
                  className="text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Button */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <nav className="flex flex-col gap-4 mt-8">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => setMenuOpen(false)}
                        className={`flex items-center gap-3 text-lg font-medium transition-colors ${
                          isActive
                            ? "text-primary"
                            : "text-foreground hover:text-primary"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {item.label}
                      </Link>
                    );
                  })}
                  <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-border">
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => {
                        if (onOpenSettings) {
                          onOpenSettings();
                        } else {
                          navigate("/tenant");
                        }
                        setMenuOpen(false);
                      }}
                    >
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-destructive hover:text-destructive"
                      onClick={async () => {
                        setMenuOpen(false);
                        localStorage.setItem('just_signed_out', Date.now().toString());
                        await signOut();
                        window.location.href = "/auth";
                      }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign out
                    </Button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
    </>
  );
}
