import { 
  DollarSign, 
  MousePointer, 
  Hash, 
  Percent, 
  Users, 
  Target, 
  Eye, 
  MousePointerClick, 
  Globe, 
  Activity,
  Bot
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface OverviewViewProps {
  data: any[];
  isLoading: boolean;
}

// Componente Local de Card para a Visão Geral
const OverviewCard = ({ title, value, icon: Icon, format, isLoading }: any) => {
  const formattedValue = () => {
    if (format === 'currency') return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
    if (format === 'percentage') return `${(value || 0).toFixed(2)}%`;
    if (format === 'decimal') return (value || 0).toFixed(2);
    return new Intl.NumberFormat("pt-BR").format(value || 0);
  };

  if (isLoading) {
    return (
      <div className="bg-[#1e293b]/40 border border-slate-700/50 p-4 rounded-xl">
        <Skeleton className="h-3 w-1/2 mb-2 bg-slate-700" />
        <Skeleton className="h-6 w-3/4 bg-slate-700" />
      </div>
    );
  }

  return (
    <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 p-4 rounded-xl hover:border-[#f90f54]/30 transition-all group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</span>
        <Icon className="w-4 h-4 text-[#f90f54] opacity-60 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-xl font-bold text-white truncate">
        {formattedValue()}
      </p>
    </div>
  );
};

export const OverviewView = ({ data, isLoading }: OverviewViewProps) => {
  
  // 1. Calcular Totais da Visão Geral
  const totals = (data || []).reduce((acc, curr) => ({
    spend: acc.spend + (curr.spend || 0),
    impressions: acc.impressions + (curr.impressions || 0),
    clicks: acc.clicks + (curr.clicks || 0),
    leads: acc.leads + (curr.leads || 0),
    reach: acc.reach + (curr.reach || 0),
  }), { spend: 0, impressions: 0, clicks: 0, leads: 0, reach: 0 });

  // 2. Calcular Métricas Derivadas
  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpl = totals.leads > 0 ? totals.spend / totals.leads : 0;
  const frequency = totals.reach > 0 ? totals.impressions / totals.reach : 0;

  // Lista dos 10 Cards solicitados
  const cards = [
    { title: "Investimento Total", value: totals.spend, icon: DollarSign, format: 'currency' },
    { title: "CPC", value: cpc, icon: MousePointer, format: 'currency' },
    { title: "CPM", value: cpm, icon: Hash, format: 'currency' },
    { title: "CTR", value: ctr, icon: Percent, format: 'percentage' },
    { title: "Conversões", value: totals.leads, icon: Target, format: 'number' },
    { title: "CPL", value: cpl, icon: Users, format: 'currency' },
    { title: "Impressões", value: totals.impressions, icon: Eye, format: 'number' },
    { title: "Cliques", value: totals.clicks, icon: MousePointerClick, format: 'number' },
    { title: "Alcance", value: totals.reach, icon: Globe, format: 'number' },
    { title: "Frequência", value: frequency, icon: Activity, format: 'decimal' },
  ];

  return (
    <div className="space-y-6">
      
      {/* Grade de 10 Cards Detalhados */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((card, index) => (
          <OverviewCard
            key={index}
            title={card.title}
            value={card.value}
            icon={card.icon}
            format={card.format}
            isLoading={isLoading}
          />
        ))}
      </div>

      {/* Sessão de Insights da IA (Substituindo o Gráfico) */}
      <Card className="bg-[#1e293b]/40 border-slate-700/50 backdrop-blur-md">
        <CardHeader className="border-b border-slate-700/50 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <Bot className="w-5 h-5 text-[#f90f54]" />
            Insights de Performance (IA)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="min-h-[200px] flex flex-col items-center justify-center text-slate-400 text-sm border-2 border-dashed border-slate-700/30 rounded-xl bg-slate-900/20 p-8 text-center">
            <Bot className="w-10 h-10 mb-4 text-slate-600" />
            <p className="max-w-md">
              Seus dados estão sendo processados. A Inteligência Artificial analisará seus 
              CPCs e CTRs para sugerir otimizações de orçamento em breve.
            </p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};