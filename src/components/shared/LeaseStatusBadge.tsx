import { Badge } from "@/components/ui/badge";

interface LeaseStatusBadgeProps {
  status: string;
}

export function LeaseStatusBadge({ status }: LeaseStatusBadgeProps) {
  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { label: "Draft", variant: "outline" },
    sent: { label: "Sent", variant: "default" },
    delivered: { label: "Delivered", variant: "default" },
    signed: { label: "Signed", variant: "default" },
    completed: { label: "Completed", variant: "default" },
    declined: { label: "Declined", variant: "destructive" },
    voided: { label: "Voided", variant: "secondary" },
  };

  const config = statusConfig[status] || { label: status, variant: "outline" };

  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}
