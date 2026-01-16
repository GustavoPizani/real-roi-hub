import { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CampaignData {
  campaign_name: string;
  ad_set_name?: string;
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  ctr: number;
  cpm: number;
  cpc: number;
  leads: number;
  cpl: number;
}

interface CampaignViewProps {
  campaigns: CampaignData[];
}

type SortKey = keyof CampaignData;

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

const CampaignView = ({ campaigns }: CampaignViewProps) => {
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

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const aVal = a[sortKey] ?? 0;
    const bVal = b[sortKey] ?? 0;
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal) * multiplier;
    }
    return ((aVal as number) - (bVal as number)) * multiplier;
  });

  // Calculate min/max for heatmap
  const getMinMax = (key: keyof CampaignData) => {
    const values = campaigns.map(c => (c[key] as number) || 0);
    return { min: Math.min(...values), max: Math.max(...values) };
  };

  const spendRange = getMinMax('spend');
  const impressionsRange = getMinMax('impressions');
  const clicksRange = getMinMax('clicks');
  const ctrRange = getMinMax('ctr');
  const cpmRange = getMinMax('cpm');
  const cpcRange = getMinMax('cpc');
  const leadsRange = getMinMax('leads');
  const cplRange = getMinMax('cpl');

  // Totals
  const totals = campaigns.reduce((acc, c) => ({
    spend: acc.spend + c.spend,
    impressions: acc.impressions + c.impressions,
    clicks: acc.clicks + c.clicks,
    link_clicks: acc.link_clicks + c.link_clicks,
    leads: acc.leads + c.leads,
  }), { spend: 0, impressions: 0, clicks: 0, link_clicks: 0, leads: 0 });

  const totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const totalCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
  const totalCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const totalCpl = totals.leads > 0 ? totals.spend / totals.leads : 0;

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <th 
      className="pb-4 uppercase tracking-widest cursor-pointer hover:text-[#f90f54] transition-colors text-right"
      onClick={() => handleSort(sortKeyName)}
    >
      <div className="flex items-center justify-end gap-1">
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
        <h3 className="text-sm font-bold uppercase text-white mb-6 tracking-widest">
          Performance por Campanha
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800/50">
                <th className="pb-4 uppercase tracking-widest text-left">Campanha</th>
                <th className="pb-4 uppercase tracking-widest text-left">Conjunto</th>
                <SortHeader label="Gasto" sortKeyName="spend" />
                <SortHeader label="Impressões" sortKeyName="impressions" />
                <SortHeader label="Cliques" sortKeyName="link_clicks" />
                <SortHeader label="CTR" sortKeyName="ctr" />
                <SortHeader label="CPM" sortKeyName="cpm" />
                <SortHeader label="CPC" sortKeyName="cpc" />
                <SortHeader label="Leads" sortKeyName="leads" />
                <SortHeader label="CPL" sortKeyName="cpl" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {sortedCampaigns.map((campaign, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-all">
                  <td className="py-4 font-medium text-slate-200 max-w-[200px] truncate">
                    {campaign.campaign_name}
                  </td>
                  <td className="py-4 text-slate-400 max-w-[150px] truncate">
                    {campaign.ad_set_name || '-'}
                  </td>
                  <td className={`py-4 text-right font-mono px-2 rounded ${getHeatmapColor(campaign.spend, spendRange.min, spendRange.max)}`}>
                    {formatNumber(campaign.spend, 'currency')}
                  </td>
                  <td className={`py-4 text-right font-mono px-2 rounded ${getHeatmapColor(campaign.impressions, impressionsRange.min, impressionsRange.max)}`}>
                    {formatNumber(campaign.impressions)}
                  </td>
                  <td className={`py-4 text-right font-mono px-2 rounded ${getHeatmapColor(campaign.link_clicks, clicksRange.min, clicksRange.max)}`}>
                    {formatNumber(campaign.link_clicks)}
                  </td>
                  <td className={`py-4 text-right font-mono px-2 rounded ${getHeatmapColor(campaign.ctr, ctrRange.min, ctrRange.max)}`}>
                    {formatNumber(campaign.ctr, 'percent')}
                  </td>
                  <td className={`py-4 text-right font-mono px-2 rounded ${getHeatmapColor(campaign.cpm, cpmRange.min, cpmRange.max, true)}`}>
                    {formatNumber(campaign.cpm, 'currency')}
                  </td>
                  <td className={`py-4 text-right font-mono px-2 rounded ${getHeatmapColor(campaign.cpc, cpcRange.min, cpcRange.max, true)}`}>
                    {formatNumber(campaign.cpc, 'currency')}
                  </td>
                  <td className={`py-4 text-right font-mono px-2 rounded ${getHeatmapColor(campaign.leads, leadsRange.min, leadsRange.max)}`}>
                    {formatNumber(campaign.leads)}
                  </td>
                  <td className={`py-4 text-right font-mono px-2 rounded ${getHeatmapColor(campaign.cpl, cplRange.min, cplRange.max, true)}`}>
                    {formatNumber(campaign.cpl, 'currency')}
                  </td>
                </tr>
              ))}
              
              {/* Totals Row */}
              <tr className="bg-slate-800/30 font-bold">
                <td className="py-4 text-[#f90f54]">Total Geral</td>
                <td className="py-4 text-slate-400">-</td>
                <td className="py-4 text-right font-mono text-white">{formatNumber(totals.spend, 'currency')}</td>
                <td className="py-4 text-right font-mono text-white">{formatNumber(totals.impressions)}</td>
                <td className="py-4 text-right font-mono text-white">{formatNumber(totals.link_clicks)}</td>
                <td className="py-4 text-right font-mono text-cyan-400">{formatNumber(totalCtr, 'percent')}</td>
                <td className="py-4 text-right font-mono text-purple-400">{formatNumber(totalCpm, 'currency')}</td>
                <td className="py-4 text-right font-mono text-green-400">{formatNumber(totalCpc, 'currency')}</td>
                <td className="py-4 text-right font-mono text-[#f90f54]">{formatNumber(totals.leads)}</td>
                <td className="py-4 text-right font-mono text-orange-400">{formatNumber(totalCpl, 'currency')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CampaignView;
