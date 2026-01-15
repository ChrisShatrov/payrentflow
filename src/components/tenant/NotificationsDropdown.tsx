import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, AlertCircle, DollarSign } from "lucide-react";
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
  type: "overdue" | "late_fee";
  title: string;
  message: string;
  statementId: string;
  periodMonth: string;
  amount?: number;
  createdAt: string;
}

export function NotificationsDropdown() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
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
      // Fetch tenant's unit
      const { data: unitData } = await supabase
        .from("units")
        .select("id, unit_number, due_day, property:properties(name)")
        .eq("tenant_id", user.id)
        .maybeSingle();

      if (!unitData) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      // Fetch overdue and unpaid statements
      const { data: statements } = await supabase
        .from("statements")
        .select("*")
        .eq("unit_id", unitData.id)
        .in("status", ["overdue", "unpaid"])
        .order("period_month", { ascending: false });

      if (!statements) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      const today = new Date();
      const notificationList: Notification[] = [];

      statements.forEach((statement) => {
        const [month, year] = statement.period_month.split("/").map(Number);
        const dueDate = new Date(year, month - 1, unitData.due_day);
        const isOverdue = statement.status === "overdue" || (today > dueDate && statement.status !== "paid");
        
        // Check if overdue (only show if not paid)
        if (isOverdue) {
          notificationList.push({
            id: `overdue-${statement.id}`,
            type: "overdue",
            title: "Rent Overdue",
            message: `Your rent payment for ${format(new Date(year, month - 1), "MMMM yyyy")} is overdue. Please make a payment to avoid additional fees.`,
            statementId: statement.id,
            periodMonth: statement.period_month,
            amount: statement.total_due,
            createdAt: statement.created_at || new Date().toISOString(),
          });
        }

        // Check if late fees have been applied (only if statement is not paid)
        if (statement.status !== "paid" && statement.late_fee && Number(statement.late_fee) > 0) {
          notificationList.push({
            id: `late-fee-${statement.id}`,
            type: "late_fee",
            title: "Late Fee Applied",
            message: `A late fee of $${Number(statement.late_fee).toFixed(2)} has been applied to your ${format(new Date(year, month - 1), "MMMM yyyy")} statement.`,
            statementId: statement.id,
            periodMonth: statement.period_month,
            amount: Number(statement.late_fee),
            createdAt: statement.created_at || new Date().toISOString(),
          });
        }

        // Check for additional fees (like failed ACH fees) - only if statement is not paid
        if (statement.status !== "paid" && statement.additional_fees && Number(statement.additional_fees) > 0) {
          notificationList.push({
            id: `additional-fee-${statement.id}`,
            type: "late_fee",
            title: "Additional Fee Applied",
            message: `An additional fee of $${Number(statement.additional_fees).toFixed(2)} has been applied to your ${format(new Date(year, month - 1), "MMMM yyyy")} statement.`,
            statementId: statement.id,
            periodMonth: statement.period_month,
            amount: Number(statement.additional_fees),
            createdAt: statement.created_at || new Date().toISOString(),
          });
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
    navigate("/tenant/statements");
    setOpen(false);
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
                  className="flex items-start gap-3 p-3 cursor-pointer focus:bg-muted"
                >
                  <div className={`mt-0.5 rounded-full p-1.5 ${
                    notification.type === "overdue" 
                      ? "bg-destructive/10 text-destructive" 
                      : "bg-amber-100 text-amber-600"
                  }`}>
                    {notification.type === "overdue" ? (
                      <AlertCircle className="h-4 w-4" />
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
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  navigate("/tenant/statements");
                  setOpen(false);
                }}
              >
                View All Statements
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
