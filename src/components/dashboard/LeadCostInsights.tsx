import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadCostInsight {
  cost: number;
  timestamp: string;
}

interface LeadCostInsightsProps {
  cheapest: LeadCostInsight | null;
  mostExpensive: LeadCostInsight | null;
}

const InsightCard = ({ title, value, date, icon: Icon, colorClass }: { title: string, value: string, date: string, icon: React.ElementType, colorClass: string }) => (
  <div className="glass-card p-4 flex-1">
    <div className="flex items-center gap-4">
      <Icon className={`w-8 h-8 ${colorClass} flex-shrink-0`} />
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{date}</p>
      </div>
    </div>
  </div>
);

const LeadCostInsights = ({ cheapest, mostExpensive }: LeadCostInsightsProps) => {
  if (!cheapest && !mostExpensive) {
    return null;
  }

  return (
    <div className="mb-6 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-4">
        {cheapest && cheapest.cost > 0 && (
          <InsightCard
            title="Lead Mais Barato"
            value={`R$ ${cheapest.cost.toFixed(2)}`}
            date={format(new Date(cheapest.timestamp), "dd/MM 'às' HH:mm", { locale: ptBR })}
            icon={ArrowDownCircle}
            colorClass="text-emerald-500"
          />
        )}
        {mostExpensive && mostExpensive.cost > 0 && (
          <InsightCard
            title="Lead Mais Caro"
            value={`R$ ${mostExpensive.cost.toFixed(2)}`}
            date={format(new Date(mostExpensive.timestamp), "dd/MM 'às' HH:mm", { locale: ptBR })}
            icon={ArrowUpCircle}
            colorClass="text-red-500"
          />
        )}
      </div>
    </div>
  );
};

export default LeadCostInsights;