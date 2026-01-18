import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Clock, XCircle, FileText } from "lucide-react";
import { format } from "date-fns";

interface LeaseEvent {
  id: string;
  type: string;
  payload_json: any;
  created_at: string;
}

interface LeaseTimelineProps {
  leaseId: string;
}

export function LeaseTimeline({ leaseId }: LeaseTimelineProps) {
  const [events, setEvents] = useState<LeaseEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { data, error } = await supabase
          .from("lease_events")
          .select("*")
          .eq("lease_id", leaseId)
          .order("created_at", { ascending: true });

        if (error) throw error;
        setEvents(data || []);
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [leaseId]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "declined":
      case "voided":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "created":
      case "sent":
      case "delivered":
      case "signed":
      case "reminder_sent":
        return <FileText className="h-5 w-5 text-blue-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getEventLabel = (type: string) => {
    const labels: Record<string, string> = {
      created: "Lease Created",
      sent: "Sent for Signature",
      delivered: "Delivered to Recipients",
      signed: "Signed by Recipient",
      completed: "Fully Executed",
      declined: "Declined",
      voided: "Voided",
      reminder_sent: "Reminder Sent",
    };
    return labels[type] || type;
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading...</div>;
  }

  if (events.length === 0) {
    return <div className="text-center p-8 text-muted-foreground">No events yet</div>;
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        {events.map((event, index) => (
          <div key={event.id} className="flex gap-4 pb-6 last:pb-0">
            <div className="flex-shrink-0 mt-1">{getEventIcon(event.type)}</div>
            <div className="flex-1">
              <div className="font-medium">{getEventLabel(event.type)}</div>
              <div className="text-sm text-muted-foreground">
                {format(new Date(event.created_at), "PPp")}
              </div>
              {event.payload_json && Object.keys(event.payload_json).length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {JSON.stringify(event.payload_json, null, 2)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
