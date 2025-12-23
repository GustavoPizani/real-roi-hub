import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning";
  delay?: number;
}

const KPICard = ({ title, value, subtitle, icon: Icon, trend, variant = "default", delay = 0 }: KPICardProps) => {
  const variantStyles = {
    default: "from-card to-surface-2",
    primary: "from-primary/10 to-card border-primary/20",
    success: "from-neon-green/10 to-card border-neon-green/20",
    warning: "from-neon-orange/10 to-card border-neon-orange/20",
  };

  const iconStyles = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/20 text-primary",
    success: "bg-neon-green/20 text-neon-green",
    warning: "bg-neon-orange/20 text-neon-orange",
  };

  return (
    <div 
      className={cn(
        "stat-card bg-gradient-to-br",
        variantStyles[variant],
        "animate-fade-in"
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("p-3 rounded-xl", iconStyles[variant])}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full",
            trend.isPositive ? "bg-neon-green/10 text-neon-green" : "bg-destructive/10 text-destructive"
          )}>
            <span>{trend.isPositive ? "+" : ""}{trend.value}%</span>
          </div>
        )}
      </div>
      
      <div>
        <p className="kpi-label mb-1">{title}</p>
        <p className="kpi-value">{value}</p>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

export default KPICard;
