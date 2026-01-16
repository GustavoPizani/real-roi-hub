import { TrendingUp, TrendingDown, DollarSign, MousePointer, Eye, Users, Target, Percent } from "lucide-react";

interface OverviewViewProps {
  kpis: {
    spend: number;
    impressions: number;
    clicks: number;
    leads: number;
    ctr: number;
    cpc: number;
    cpm: number;
    cpl: number;
    reach: number;
    frequency: number;
  };
  previousPeriodKpis?: {
    spend: number;
    cpc: number;
    cpm: number;
    ctr: number;
    cpl: number;
  };
  funnelData: { name: string; value: number; percentage: number; color: string }[];
}

// Função de formatação blindada contra undefined/null
const formatNumber = (value: number | undefined | null, type: 'currency' | 'number' | 'percent' = 'number'): string => {
  const safeValue = value ?? 0; // Se for undefined/null, vira 0

  if (type === 'currency') {
    return `R$ ${safeValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (type === 'percent') {
    return `${safeValue.toFixed(2)}%`;
  }
  if (safeValue >= 1000000) {
    return `${(safeValue / 1000000).toFixed(1)}M`;
  }
  if (safeValue >= 1000) {
    return `${(safeValue / 1000).toFixed(1)}K`;
  }
  return safeValue.toLocaleString('pt-BR');
};

const calcVariation = (current: number | undefined, previous?: number): { value: number; isPositive: boolean } | null => {
  const safeCurrent = current ?? 0;
  if (!previous || previous === 0) return null;
  const variation = ((safeCurrent - previous) / previous) * 100;
  return { value: Math.abs(variation), isPositive: variation >= 0 };
};

const KPICard = ({ 
  label, 
  value, 
  icon: Icon, 
  color = 'text-white',
  variation,
  invertVariation = false
}: { 
  label: string; 
  value: string; 
  icon: React.ElementType;
  color?: string;
  variation?: { value: number; isPositive: boolean } | null;
  invertVariation?: boolean;
}) => {
  const isPositive = variation ? (invertVariation ? !variation.isPositive : variation.isPositive) : true;
  
  return (
    <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 p-5 md:p-6 rounded-2xl shadow-xl hover:border-[#f90f54]/30 transition-all group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 ${color} opacity-60 group-hover:opacity-100 transition-opacity`} />
      </div>
      <p className={`text-2xl md:text-3xl font-bold mt-2 tracking-tight ${color}`}>{value}</p>
      {variation && (
        <div className="flex items-center gap-1 mt-2">
          {isPositive ? (
            <TrendingUp className="w-3 h-3 text-green-400" />
          ) : (
            <TrendingDown className="w-3 h-3 text-red-400" />
          )}
          <span className={`text-[10px] font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {variation.value.toFixed(1)}%
          </span>
          <span className="text-[10px] text-slate-500">vs período anterior</span>
        </div>
      )}
    </div>
  );
};

const OverviewView = ({ kpis, previousPeriodKpis, funnelData }: OverviewViewProps) => {
  // Se kpis for undefined, retornamos um aviso ou um esqueleto de carregamento
  if (!kpis) {
    return (
      <div className="p-8 text-center bg-[#1e293b]/20 rounded-2xl border border-slate-800">
        <p className="text-slate-400 font-medium">Aguardando dados das campanhas...</p>
        <p className="text-xs text-slate-500 mt-2">Faça o upload de uma planilha para visualizar as métricas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard 
          label="Investimento Total" 
          value={formatNumber(kpis.spend, 'currency')} 
          icon={DollarSign}
          color="text-white"
          variation={calcVariation(kpis.spend, previousPeriodKpis?.spend)}
        />
        <KPICard 
          label="CPC" 
          value={formatNumber(kpis.cpc, 'currency')} 
          icon={MousePointer}
          color="text-cyan-400"
          variation={calcVariation(kpis.cpc, previousPeriodKpis?.cpc)}
          invertVariation={true}
        />
        <KPICard 
          label="CPM" 
          value={formatNumber(kpis.cpm, 'currency')} 
          icon={Eye}
          color="text-purple-400"
          variation={calcVariation(kpis.cpm, previousPeriodKpis?.cpm)}
          invertVariation={true}
        />
        <KPICard 
          label="CTR" 
          value={formatNumber(kpis.ctr, 'percent')} 
          icon={Percent}
          color="text-green-400"
          variation={calcVariation(kpis.ctr, previousPeriodKpis?.ctr)}
        />
        <KPICard 
          label="Conversões" 
          value={formatNumber(kpis.leads)} 
          icon={Users}
          color="text-[#f90f54]"
        />
        <KPICard 
          label="CPL" 
          value={formatNumber(kpis.cpl, 'currency')} 
          icon={Target}
          color="text-orange-400"
          variation={calcVariation(kpis.cpl, previousPeriodKpis?.cpl)}
          invertVariation={true}
        />
      </div>

      {/* Secondary Metrics - Blindadas com (?? 0) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 p-4 rounded-xl">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Impressões</span>
          <p className="text-xl font-bold mt-1 text-slate-200">{formatNumber(kpis.impressions)}</p>
        </div>
        <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 p-4 rounded-xl">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cliques</span>
          <p className="text-xl font-bold mt-1 text-slate-200">{formatNumber(kpis.clicks)}</p>
        </div>
        <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 p-4 rounded-xl">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Alcance</span>
          <p className="text-xl font-bold mt-1 text-slate-200">{formatNumber(kpis.reach)}</p>
        </div>
        <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 p-4 rounded-xl">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Frequência</span>
          <p className="text-xl font-bold mt-1 text-slate-200">{(kpis.frequency ?? 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Performance Funnel - Blindado com (funnelData ?? []) */}
      <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 md:p-7 shadow-xl">
        <h3 className="text-sm font-bold mb-6 uppercase text-slate-400 tracking-[0.15em]">Funil de Performance</h3>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-full max-w-md space-y-2">
              {(funnelData ?? []).map((item, index) => (
                <div 
                  key={index} 
                  className="relative overflow-hidden"
                  style={{ 
                    width: `${100 - (index * 15)}%`,
                    marginLeft: `${index * 7.5}%`
                  }}
                >
                  <div className={`${item.color} h-12 md:h-14 rounded-lg flex items-center justify-center relative`}>
                    <div className="flex items-center gap-2 text-white font-bold text-sm">
                      <span>{formatNumber(item.value)}</span>
                    </div>
                  </div>
                  <div className="absolute -right-20 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xs">
                    <span className="text-slate-400">{item.name}</span>
                    {index > 0 && (
                      <span className="text-slate-500">({(item.percentage ?? 0).toFixed(1)}%)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-4">
            {(funnelData ?? []).map((item, index) => (
              <div key={index} className="group">
                <div className="flex justify-between text-[10px] font-black mb-2 uppercase tracking-widest">
                  <span className="text-slate-300">{item.name}</span>
                  <span className="text-white bg-slate-800/50 px-2 py-0.5 rounded">
                    {formatNumber(item.value)} {index > 0 && `(${(item.percentage ?? 0).toFixed(1)}%)`}
                  </span>
                </div>
                <div className="w-full bg-slate-800/50 h-5 rounded-lg overflow-hidden border border-slate-700/30">
                  <div 
                    className={`${item.color} h-full transition-all duration-1000 shadow-lg`} 
                    style={{ width: `${Math.min(item.percentage ?? 0, 100)}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewView;
