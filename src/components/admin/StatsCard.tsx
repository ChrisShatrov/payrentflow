import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  accentColor?: "primary" | "blue" | "accent" | "warning";
  href?: string;
}

const accentStyles = {
  primary: "border-t-primary",
  blue: "border-t-sky-400",
  accent: "border-t-accent",
  warning: "border-t-yellow-500",
};

const iconStyles = {
  primary: "bg-primary/10 text-primary",
  blue: "bg-sky-100 text-sky-600",
  accent: "bg-accent/50 text-accent-foreground",
  warning: "bg-yellow-500/10 text-yellow-600",
};

export function StatsCard({ title, value, icon: Icon, accentColor = "primary", href }: StatsCardProps) {
  const cardContent = (
    <div className={cn(
      "bg-card rounded-xl p-6 border border-border shadow-sm border-t-4",
      accentStyles[accentColor],
      href && "cursor-pointer hover:shadow-md transition-shadow"
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

  if (href) {
    return (
      <Link to={href} className="block">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
