import { TemporalChart } from "@/components/dashboard/TemporalChart";
import { 
  DollarSign, MousePointer, Hash, Percent, Users, Target, Eye, 
  MousePointerClick, Globe, Activity, Bot, TrendingUp, AlertTriangle, CheckCircle, TrendingDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// --- COMPONENTE KPICard DEFINIDO LOCALMENTE (Correção do Erro) ---
interface KPICardProps {
  title: string;
  value: number;
  icon: any;
  trend?: string;
  trendUp?: boolean;
  format: 'currency' | 'number' | 'percentage' | 'decimal';
  isLoading: boolean;
  invertTrendColor?: boolean;
}

const KPICard = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendUp, 
  format, 
  isLoading,
  invertTrendColor = false 
}: KPICardProps) => {
  
  const formattedValue = () => {
    if (format === 'currency') {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
    }
    if (format === 'percentage') {
      return `${(value || 0).toFixed(2)}%`;
    }
    if (format === 'decimal') {
      return (value || 0).toFixed(2);
    }
    return new Intl.NumberFormat("pt-BR").format(value || 0);
  };

  // Estilo Neon/Glassmorphism Escuro
  const cardStyle = "bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 p-5 rounded-2xl shadow-xl hover:border-[#f90f54]/30 transition-all group";

  if (isLoading) {
    return (
      <div className={cardStyle}>
        <div className="flex flex-row items-center justify-between space-y-0 pb-2 mb-2">
          <Skeleton className="h-4 w-[100px] bg-slate-700" />
          <Skeleton className="h-4 w-4 bg-slate-700" />
        </div>
        <div>
          <Skeleton className="h-8 w-[120px] mb-2 bg-slate-700" />
          <Skeleton className="h-3 w-[80px] bg-slate-700" />
        </div>
      </div>
    );
  }

  const isPositiveOutcome = invertTrendColor ? !trendUp : trendUp;
  const TrendIcon = isPositiveOutcome ? TrendingUp : TrendingDown;
  const trendColorClass = isPositiveOutcome ? "text-green-400" : "text-red-400";

  return (
    <div className={cardStyle}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</span>
        <Icon className="w-4 h-4 text-[#f90f54] opacity-70 group-hover:opacity-100 transition-opacity" />
      </div>
      
      <p className="text-2xl font-bold mt-2 tracking-tight text-white truncate">
        {formattedValue()}
      </p>
      
      {trend && (
        <div className="flex items-center gap-1 mt-2">
          <TrendIcon className={`w-3 h-3 ${trendColorClass}`} />
          <span className={`text-[10px] font-medium ${trendColorClass}`}>
            {trend}
          </span>
          <span className="text-[10px] text-slate-500">vs anterior</span>
        </div>
      )}
    </div>
  );
};
// ------------------------------------------------------------------

interface OverviewViewProps {
  data: any[]; 
  dailyData?: any[]; 
  isLoading: boolean;
}

export const OverviewView = ({ data, dailyData, isLoading }: OverviewViewProps) => {
  
  // 1. Totais
  const totals = (data || []).reduce((acc, curr) => ({
    spend: acc.spend + (curr.spend || 0),
    impressions: acc.impressions + (curr.impressions || 0),
    clicks: acc.clicks + (curr.clicks || 0),
    leads: acc.leads + (curr.leads || 0),
    reach: acc.reach + (curr.reach || 0),
  }), { spend: 0, impressions: 0, clicks: 0, leads: 0, reach: 0 });

  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpl = totals.leads > 0 ? totals.spend / totals.leads : 0;
  const frequency = totals.reach > 0 ? totals.impressions / totals.reach : 0;

  // 2. Insights IA
  const generateInsights = () => {
    const insights = [];

    if (cpl > 50) {
      insights.push({ type: 'warning', text: `Alerta de Custo: CPL global alto (R$ ${cpl.toFixed(2)}). Verifique criativos com CTR < 1%.` });
    } else if (cpl > 0 && cpl < 15) {
      insights.push({ type: 'success', text: `Ótimo desempenho! CPL de R$ ${cpl.toFixed(2)} está excelente. Escalar orçamento recomendado.` });
    }

    if (ctr < 0.8 && totals.impressions > 1000) {
      insights.push({ type: 'warning', text: `Fadiga de Criativo? CTR baixo (${ctr.toFixed(2)}%). Renove imagens ou headlines.` });
    }

    const campaignsWithSpendNoLeads = data.filter(c => c.spend > 100 && c.leads === 0);
    if (campaignsWithSpendNoLeads.length > 0) {
      insights.push({ type: 'danger', text: `Atenção: ${campaignsWithSpendNoLeads.length} campanha(s) gastaram >R$ 100 sem leads. Pause imediatamente.` });
    }

    if (insights.length === 0) {
      insights.push({ type: 'info', text: "Otimização Estável. Indicadores normais. A IA continua monitorando." });
    }

    return insights;
  };

  const aiInsights = generateInsights();

  const cards = [
    { title: "Investimento Total", value: totals.spend, icon: DollarSign, format: 'currency' },
    { title: "CPC", value: cpc, icon: MousePointer, format: 'currency', invert: true },
    { title: "CPM", value: cpm, icon: Hash, format: 'currency', invert: true },
    { title: "CTR", value: ctr, icon: Percent, format: 'percentage' },
    { title: "Conversões", value: totals.leads, icon: Target, format: 'number' },
    { title: "CPL", value: cpl, icon: Users, format: 'currency', invert: true },
    { title: "Impressões", value: totals.impressions, icon: Eye, format: 'number' },
    { title: "Cliques", value: totals.clicks, icon: MousePointerClick, format: 'number' },
    { title: "Alcance", value: totals.reach, icon: Globe, format: 'number' },
    { title: "Frequência", value: frequency, icon: Activity, format: 'decimal' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Grade de Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map((card, index) => (
          <KPICard
            key={index}
            title={card.title}
            value={card.value}
            icon={card.icon}
            format={card.format as any}
            isLoading={isLoading}
            invertTrendColor={card.invert}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. Gráfico Temporal */}
        <div className="lg:col-span-2">
          <TemporalChart data={dailyData || []} isLoading={isLoading} />
        </div>

        {/* 3. Painel de Insights da IA */}
        <Card className="bg-[#1e293b]/40 border-slate-700/50 backdrop-blur-md h-full flex flex-col">
          <CardHeader className="border-b border-slate-700/50 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Bot className="w-5 h-5 text-[#f90f54]" />
              Insights da IA
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 flex-1">
            {isLoading ? (
               <div className="space-y-3">
                 <div className="h-4 bg-slate-700 rounded w-3/4 animate-pulse"></div>
                 <div className="h-4 bg-slate-700 rounded w-1/2 animate-pulse"></div>
               </div>
            ) : (
              <div className="space-y-4">
                {aiInsights.map((insight, idx) => (
                  <div key={idx} className="flex gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-800">
                    <div className="shrink-0 mt-0.5">
                      {insight.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
                      {insight.type === 'danger' && <AlertTriangle className="w-5 h-5 text-red-500" />}
                      {insight.type === 'success' && <TrendingUp className="w-5 h-5 text-green-500" />}
                      {insight.type === 'info' && <CheckCircle className="w-5 h-5 text-blue-500" />}
                    </div>
                    <p className="text-sm text-slate-300 leading-snug">
                      {insight.text}
                    </p>
                  </div>
                ))}
                <div className="pt-4 mt-auto">
                  <p className="text-xs text-slate-500 text-center">
                    Análise baseada nos últimos dados sincronizados.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};