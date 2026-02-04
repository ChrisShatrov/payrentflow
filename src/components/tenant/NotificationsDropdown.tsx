import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, AlertCircle, DollarSign, X, FileSignature, CalendarClock, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: "overdue" | "late_fee" | "lease_sign" | "lease_expire" | "unit_assigned";
  title: string;
  message: string;
  statementId?: string;
  periodMonth?: string;
  leaseId?: string;
  amount?: number;
  createdAt: string;
}

export function NotificationsDropdown() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Refresh notifications every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      // Fetch dismissed notifications first to ensure we have the latest list
      const { data: dismissedData } = await supabase
        .from("dismissed_notifications")
        .select("notification_id")
        .eq("tenant_id", user.id);

      const dismissedIds = new Set(dismissedData?.map((d) => d.notification_id) || []);
      setDismissedNotificationIds(dismissedIds);

      const today = new Date();

      // Fetch in-app tenant notifications (e.g. "You've been assigned to a unit")
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: tenantNotificationRows } = await supabase
        .from("tenant_notifications")
        .select("id, type, title, message, created_at")
        .eq("tenant_id", user.id)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });
      const tenantNotificationItems: Notification[] = (tenantNotificationRows || [])
        .filter((row: { id: string }) => !dismissedIds.has(`unit_assigned-${row.id}`))
        .map((row: { id: string; type: string; title: string; message: string; created_at: string }) => ({
          id: `unit_assigned-${row.id}`,
          type: "unit_assigned" as const,
          title: row.title,
          message: row.message,
          createdAt: row.created_at,
        }));

      // Fetch tenant's unit
      const { data: unitData } = await supabase
        .from("units")
        .select("id, unit_number, due_day, property:properties(name)")
        .eq("tenant_id", user.id)
        .maybeSingle();

      // Fetch leases for this tenant (use lease_data_json for end date; end_date column may not exist if migration not applied)
      const { data: tenantLeases, error: leasesError } = await supabase
        .from("leases")
        .select("id, status, updated_at, unit_id, lease_data_json")
        .eq("tenant_id", user.id)
        .order("updated_at", { ascending: false });

      if (leasesError) {
        console.warn("Leases fetch failed (notifications):", leasesError);
      }

      const unitIds = [...new Set((tenantLeases || []).map((l: { unit_id?: string }) => l.unit_id).filter(Boolean))] as string[];
      const unitMap = new Map<string, { unit_number: string; propertyName: string }>();
      if (unitIds.length > 0) {
        const { data: unitsData } = await supabase
          .from("units")
          .select("id, unit_number, property_id")
          .in("id", unitIds);
        const propertyIds = [...new Set((unitsData || []).map((u: { property_id: string }) => u.property_id).filter(Boolean))] as string[];
        const { data: propsData } = await supabase
          .from("properties")
          .select("id, name")
          .in("id", propertyIds);
        const propMap = new Map((propsData || []).map((p: { id: string; name: string }) => [p.id, p.name]));
        (unitsData || []).forEach((u: { id: string; unit_number: string; property_id: string }) => {
          unitMap.set(u.id, { unit_number: u.unit_number, propertyName: propMap.get(u.property_id) ?? "Property" });
        });
      }

      const leaseNotifications: Notification[] = [];
      (tenantLeases || []).forEach((lease: { id: string; status: string; updated_at?: string; unit_id?: string; lease_data_json?: { lease_end_date?: string } }) => {
        const u = lease.unit_id ? unitMap.get(lease.unit_id) : null;
        const props = { name: u?.propertyName ?? "Property", unit: u?.unit_number ?? "" };
        if (lease.status === "sent" || lease.status === "delivered") {
          const notificationId = `lease-sign-${lease.id}`;
          if (!dismissedIds.has(notificationId)) {
            leaseNotifications.push({
              id: notificationId,
              type: "lease_sign",
              title: "Lease needs your signature",
              message: `Your lease for ${props.name}${props.unit ? `, Unit ${props.unit}` : ""} is waiting for your signature.`,
              leaseId: lease.id,
              createdAt: lease.updated_at || new Date().toISOString(),
            });
          }
        }
        const endDateStr = lease.lease_data_json?.lease_end_date;
        if (lease.status === "completed" && endDateStr) {
          const endDate = new Date(endDateStr);
          const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
          if (daysLeft > 0 && daysLeft <= 90) {
            const notificationId = `lease-expire-${lease.id}-${daysLeft <= 30 ? 30 : daysLeft <= 60 ? 60 : 90}`;
            if (!dismissedIds.has(notificationId)) {
              leaseNotifications.push({
                id: notificationId,
                type: "lease_expire",
                title: "Lease expiring soon",
                message: `Your lease for ${props.name}${props.unit ? `, Unit ${props.unit}` : ""} expires in ${daysLeft} days (${format(endDate, "MMM d, yyyy")}).`,
                leaseId: lease.id,
                createdAt: lease.updated_at || new Date().toISOString(),
              });
            }
          }
        }
      });

      if (!unitData) {
        // Still show lease and tenant_notifications (e.g. unit assigned) if no unit yet
        const combined = [...tenantNotificationItems, ...leaseNotifications];
        const sorted = combined.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setNotifications(sorted);
        setLoading(false);
        return;
      }

      // Fetch overdue, unpaid, and partial statements
      const { data: statements } = await supabase
        .from("statements")
        .select("*")
        .eq("unit_id", unitData.id)
        .in("status", ["overdue", "unpaid", "partial"])
        .order("period_month", { ascending: false });

      const notificationList: Notification[] = [...tenantNotificationItems, ...leaseNotifications];
      if (!statements) {
        notificationList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(notificationList);
        setLoading(false);
        return;
      }

      statements.forEach((statement) => {
        const [month, year] = statement.period_month.split("/").map(Number);
        const dueDate = new Date(year, month - 1, unitData.due_day);
        const isOverdue = statement.status === "overdue" || (today > dueDate && statement.status !== "paid");
        
        // Check if overdue (only show if not paid)
        if (isOverdue) {
          const notificationId = `overdue-${statement.id}`;
          if (!dismissedIds.has(notificationId)) {
            // Use explicit sum so amount matches dashboard (base + late + additional + split)
            const amountDue = Number(statement.base_rent || 0)
              + Number(statement.late_fee || 0)
              + Number(statement.additional_fees || 0)
              + Number(statement.split_fee || 0);
            notificationList.push({
              id: notificationId,
              type: "overdue",
              title: "Rent Overdue",
              message: `Your rent payment for ${format(new Date(year, month - 1), "MMMM yyyy")} is overdue. Please make a payment to avoid additional fees.`,
              statementId: statement.id,
              periodMonth: statement.period_month,
              amount: amountDue,
              createdAt: statement.created_at || new Date().toISOString(),
            });
          }
        }

        // Check if late fees have been applied (only if statement is not paid)
        if (statement.status !== "paid" && statement.late_fee && Number(statement.late_fee) > 0) {
          const notificationId = `late-fee-${statement.id}`;
          if (!dismissedIds.has(notificationId)) {
            notificationList.push({
              id: notificationId,
              type: "late_fee",
              title: "Late Fee Applied",
              message: `A late fee of $${Number(statement.late_fee).toFixed(2)} has been applied to your ${format(new Date(year, month - 1), "MMMM yyyy")} statement.`,
              statementId: statement.id,
              periodMonth: statement.period_month,
              amount: Number(statement.late_fee),
              createdAt: statement.created_at || new Date().toISOString(),
            });
          }
        }

        // Check for additional fees (like failed ACH fees) - only if statement is not paid
        if (statement.status !== "paid" && statement.additional_fees && Number(statement.additional_fees) > 0) {
          const notificationId = `additional-fee-${statement.id}`;
          if (!dismissedIds.has(notificationId)) {
            notificationList.push({
              id: notificationId,
              type: "late_fee",
              title: "Additional Fee Applied",
              message: `An additional fee of $${Number(statement.additional_fees).toFixed(2)} has been applied to your ${format(new Date(year, month - 1), "MMMM yyyy")} statement.`,
              statementId: statement.id,
              periodMonth: statement.period_month,
              amount: Number(statement.additional_fees),
              createdAt: statement.created_at || new Date().toISOString(),
            });
          }
        }
      });

      // Sort by date (newest first)
      notificationList.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setNotifications(notificationList);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.type === "unit_assigned") {
      navigate("/tenant");
    } else if (notification.type === "lease_sign" || notification.type === "lease_expire") {
      navigate("/tenant/leases");
    } else {
      navigate("/tenant/statements");
    }
    setOpen(false);
  };

  const handleDismissNotification = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation when clicking dismiss

    if (!user) return;

    try {
      // Insert dismissed notification
      const { error } = await supabase
        .from("dismissed_notifications")
        .insert({
          tenant_id: user.id,
          notification_id: notificationId,
        });

      if (error) {
        // If it's a unique constraint error, it's already dismissed - that's fine
        if (error.code !== "23505") {
          console.error("Error dismissing notification:", error);
          toast.error("Failed to dismiss notification");
          return;
        }
      }

      // Update local state
      setDismissedNotificationIds((prev) => new Set(prev).add(notificationId));
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

      toast.success("Notification dismissed");
    } catch (error) {
      console.error("Error dismissing notification:", error);
      toast.error("Failed to dismiss notification");
    }
  };

  const handleClearAll = async () => {
    if (!user || notifications.length === 0) return;

    try {
      // Dismiss all current notifications
      const notificationIds = notifications.map((n) => n.id);
      const inserts = notificationIds.map((id) => ({
        tenant_id: user.id,
        notification_id: id,
      }));

      const { error } = await supabase
        .from("dismissed_notifications")
        .insert(inserts);

      if (error) {
        // Some might already be dismissed, that's fine - just log
        console.log("Some notifications may already be dismissed:", error);
      }

      // Update local state
      setDismissedNotificationIds((prev) => {
        const newSet = new Set(prev);
        notificationIds.forEach((id) => newSet.add(id));
        return newSet;
      });
      setNotifications([]);

      toast.success("All notifications cleared");
    } catch (error) {
      console.error("Error clearing all notifications:", error);
      toast.error("Failed to clear notifications");
    }
  };

  const unreadCount = notifications.length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unreadCount} new
            </Badge>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground mt-1">
                You're all caught up!
              </p>
            </div>
          ) : (
            <div className="py-1">
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className="flex items-start gap-3 p-3 cursor-pointer focus:bg-muted group"
                  onSelect={(e) => e.preventDefault()}
                >
                  <div className={`mt-0.5 rounded-full p-1.5 ${
                    notification.type === "overdue" 
                      ? "bg-destructive/10 text-destructive" 
                      : notification.type === "lease_sign" || notification.type === "lease_expire" || notification.type === "unit_assigned"
                        ? "bg-primary/10 text-primary"
                        : "bg-amber-100 text-amber-600"
                  }`}>
                    {notification.type === "overdue" ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : notification.type === "lease_sign" ? (
                      <FileSignature className="h-4 w-4" />
                    ) : notification.type === "lease_expire" ? (
                      <CalendarClock className="h-4 w-4" />
                    ) : notification.type === "unit_assigned" ? (
                      <Home className="h-4 w-4" />
                    ) : (
                      <DollarSign className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    {notification.amount && (
                      <p className="text-xs font-semibold text-destructive mt-1">
                        ${notification.amount.toFixed(2)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDismissNotification(notification.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                    aria-label="Dismiss notification"
                    title="Dismiss"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2 space-y-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  const hasLeaseNotif = notifications.some((n) => n.type === "lease_sign" || n.type === "lease_expire");
                  navigate(hasLeaseNotif ? "/tenant/leases" : "/tenant/statements");
                  setOpen(false);
                }}
              >
                {notifications.some((n) => n.type === "lease_sign" || n.type === "lease_expire")
                  ? "View Leases"
                  : "View All Statements"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={handleClearAll}
              >
                Clear All
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
