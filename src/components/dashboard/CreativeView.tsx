import { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Image as ImageIcon, ExternalLink } from "lucide-react";

interface CreativeData {
  creative_name: string;
  ad_name?: string;
  thumbnail_url?: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  leads: number;
  cpl: number;
}

interface CreativeViewProps {
  creatives: CreativeData[];
}

type SortKey = keyof CreativeData;

const formatNumber = (value: number, type: 'currency' | 'number' | 'percent' = 'number'): string => {
  if (type === 'currency') {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (type === 'percent') {
    return `${value.toFixed(2)}%`;
  }
  return value.toLocaleString('pt-BR');
};

const getHeatmapColor = (value: number, min: number, max: number, inverse: boolean = false): string => {
  if (max === min) return 'bg-slate-800/30';
  const normalized = (value - min) / (max - min);
  const intensity = inverse ? 1 - normalized : normalized;
  
  if (intensity < 0.25) return 'bg-red-500/20 text-red-400';
  if (intensity < 0.5) return 'bg-yellow-500/20 text-yellow-400';
  if (intensity < 0.75) return 'bg-blue-500/20 text-blue-400';
  return 'bg-green-500/20 text-green-400';
};

const CreativeView = ({ creatives }: CreativeViewProps) => {
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const sortedCreatives = [...creatives].sort((a, b) => {
    const aVal = a[sortKey] ?? 0;
    const bVal = b[sortKey] ?? 0;
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal) * multiplier;
    }
    return ((aVal as number) - (bVal as number)) * multiplier;
  });

  // Calculate min/max for heatmap
  const getMinMax = (key: keyof CreativeData) => {
    const values = creatives.map(c => (c[key] as number) || 0);
    return { min: Math.min(...values), max: Math.max(...values) };
  };

  const spendRange = getMinMax('spend');
  const impressionsRange = getMinMax('impressions');
  const ctrRange = getMinMax('ctr');
  const cpcRange = getMinMax('cpc');
  const cpmRange = getMinMax('cpm');
  const leadsRange = getMinMax('leads');
  const cplRange = getMinMax('cpl');

  const SortHeader = ({ label, sortKeyName, className = "" }: { label: string; sortKeyName: SortKey; className?: string }) => (
    <th 
      className={`pb-4 uppercase tracking-widest cursor-pointer hover:text-[#f90f54] transition-colors ${className}`}
      onClick={() => handleSort(sortKeyName)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === sortKeyName ? (
          sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </div>
    </th>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 md:p-7 shadow-xl">
        <h3 className="text-sm font-bold uppercase text-white mb-6 tracking-widest flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-[#f90f54]" />
          Performance por Criativo
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800/50">
                <th className="pb-4 uppercase tracking-widest">Thumbnail</th>
                <SortHeader label="Criativo" sortKeyName="creative_name" />
                <SortHeader label="Gasto" sortKeyName="spend" className="text-right" />
                <SortHeader label="Impressões" sortKeyName="impressions" className="text-right" />
                <SortHeader label="Cliques" sortKeyName="clicks" className="text-right" />
                <SortHeader label="CTR" sortKeyName="ctr" className="text-right" />
                <SortHeader label="CPC" sortKeyName="cpc" className="text-right" />
                <SortHeader label="CPM" sortKeyName="cpm" className="text-right" />
                <SortHeader label="Leads" sortKeyName="leads" className="text-right" />
                <SortHeader label="CPL" sortKeyName="cpl" className="text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {sortedCreatives.map((creative, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-all">
                  <td className="py-3">
                    {creative.thumbnail_url ? (
                      <a 
                        href={creative.thumbnail_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block relative group"
                      >
                        <img 
                          src={creative.thumbnail_url} 
                          alt={creative.creative_name}
                          className="w-16 h-16 object-cover rounded-lg border border-slate-700/50 group-hover:border-[#f90f54]/50 transition-all"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <ExternalLink className="w-4 h-4 text-white" />
                        </div>
                      </a>
                    ) : (
                      <div className="w-16 h-16 bg-slate-800/50 rounded-lg flex items-center justify-center border border-slate-700/50">
                        <ImageIcon className="w-6 h-6 text-slate-600" />
                      </div>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="max-w-[200px]">
                      <p className="font-medium text-slate-200 truncate">{creative.creative_name}</p>
                      {creative.ad_name && (
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{creative.ad_name}</p>
                      )}
                    </div>
                  </td>
                  <td className={`py-3 text-right font-mono px-2 rounded ${getHeatmapColor(creative.spend, spendRange.min, spendRange.max)}`}>
                    {formatNumber(creative.spend, 'currency')}
                  </td>
                  <td className={`py-3 text-right font-mono px-2 rounded ${getHeatmapColor(creative.impressions, impressionsRange.min, impressionsRange.max)}`}>
                    {formatNumber(creative.impressions)}
                  </td>
                  <td className="py-3 text-right font-mono text-slate-300">
                    {formatNumber(creative.clicks)}
                  </td>
                  <td className={`py-3 text-right font-mono px-2 rounded ${getHeatmapColor(creative.ctr, ctrRange.min, ctrRange.max)}`}>
                    {formatNumber(creative.ctr, 'percent')}
                  </td>
                  <td className={`py-3 text-right font-mono px-2 rounded ${getHeatmapColor(creative.cpc, cpcRange.min, cpcRange.max, true)}`}>
                    {formatNumber(creative.cpc, 'currency')}
                  </td>
                  <td className={`py-3 text-right font-mono px-2 rounded ${getHeatmapColor(creative.cpm, cpmRange.min, cpmRange.max, true)}`}>
                    {formatNumber(creative.cpm, 'currency')}
                  </td>
                  <td className={`py-3 text-right font-mono px-2 rounded ${getHeatmapColor(creative.leads, leadsRange.min, leadsRange.max)}`}>
                    {formatNumber(creative.leads)}
                  </td>
                  <td className={`py-3 text-right font-mono px-2 rounded ${getHeatmapColor(creative.cpl, cplRange.min, cplRange.max, true)}`}>
                    {formatNumber(creative.cpl, 'currency')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {creatives.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p className="text-sm">Nenhum criativo encontrado.</p>
            <p className="text-xs mt-1">Faça upload de dados com nomes de criativos para analisar performance visual.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreativeView;
