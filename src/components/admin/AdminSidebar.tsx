import { NavLink } from "@/components/NavLink";
import { LayoutDashboard, Building2, Users, FileText, LogOut, Settings, CreditCard, FileSignature } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const navItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Properties", url: "/admin/properties", icon: Building2 },
  { title: "Tenants", url: "/admin/tenants", icon: Users },
  { title: "Lease Templates", url: "/admin/lease-templates", icon: FileSignature },
  { title: "Leases", url: "/admin/leases", icon: FileText },
  { title: "Payments", url: "/admin/payments", icon: CreditCard },
  { title: "Statements", url: "/admin/statements", icon: FileText },
  { title: "Settings", url: "/admin/settings", icon: Settings },
] as const;

interface AdminSidebarProps {
  onItemClick?: () => void;
}

export function AdminSidebar({ onItemClick }: AdminSidebarProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    // Mark that we're signing out to prevent redirect loops
    // Use localStorage so it persists across page reload
    localStorage.setItem('just_signed_out', Date.now().toString());
    await signOut();
    // Use window.location.href to force a full page reload and clear all state
    window.location.href = "/auth";
  };

  const handleItemClick = () => {
    if (onItemClick) {
      onItemClick();
    }
  };

  return (
    <aside className="w-full md:w-64 h-full bg-card flex flex-col">
      {/* Logo - Hidden on mobile since it's in the header */}
      <div className="hidden md:block p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="RentFlow" className="w-12 h-12" />
          <div className="flex flex-col">
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="text-primary">Rent</span>
              <span className="text-foreground">Flow</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Admin Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            end={item.url === "/admin"}
            onClick={handleItemClick}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            activeClassName="bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
          >
            <item.icon className="h-5 w-5" />
            <span className="font-medium">{item.title}</span>
          </NavLink>
        ))}
      </nav>

      {/* Sign Out */}
      <div className="p-4 border-t border-border">
        <button
          onClick={() => {
            handleItemClick();
            handleSignOut();
          }}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors w-full"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
