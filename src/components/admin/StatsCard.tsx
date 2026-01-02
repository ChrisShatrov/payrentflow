import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  accentColor?: "primary" | "secondary" | "accent" | "warning";
}

const accentStyles = {
  primary: "border-t-primary",
  secondary: "border-t-secondary",
  accent: "border-t-accent",
  warning: "border-t-yellow-500",
};

const iconStyles = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/50 text-secondary-foreground",
  accent: "bg-accent/50 text-accent-foreground",
  warning: "bg-yellow-500/10 text-yellow-600",
};

export function StatsCard({ title, value, icon: Icon, accentColor = "primary" }: StatsCardProps) {
  return (
    <div className={cn(
      "bg-card rounded-xl p-6 border border-border shadow-sm border-t-4",
      accentStyles[accentColor]
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
          <p className="text-4xl font-bold text-foreground mt-2">
            {value}
          </p>
        </div>
        <div className={cn("p-3 rounded-xl", iconStyles[accentColor])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
