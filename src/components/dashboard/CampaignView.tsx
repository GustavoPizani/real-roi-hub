import { useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CampaignData {
  name?: string;
  campaign_name?: string;
  ad_set_name?: string;
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  ctr: number;
  cpm: number;
  cpc: number;
  leads: number;
  leadsMeta?: number;
  cpl: number;
}

interface CampaignViewProps {
  campaigns: CampaignData[];
}

type SortKey = keyof CampaignData;

const formatNumber = (value: number | undefined | null, type: 'currency' | 'number' | 'percent' = 'number'): string => {
  // Se o valor não existir, retorna um padrão seguro
  const safeValue = value ?? 0;

  if (type === 'currency') {
    return `R$ ${safeValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (type === 'percent') {
    return `${safeValue.toFixed(2)}%`;
  }
  return safeValue.toLocaleString('pt-BR');
};

const CampaignView = ({ campaigns = [] }: CampaignViewProps) => {
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Adicione esta proteção logo no início
  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    return (
      <div className="p-8 text-center bg-[#1e293b]/20 rounded-2xl border border-slate-800">
        <p className="text-slate-400 font-medium">Nenhuma campanha encontrada no período.</p>
        <p className="text-xs text-slate-500 mt-2">Certifique-se de que os dados foram carregados ou faça um upload.</p>
      </div>
    );
  }

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
                <SortHeader label="Gasto" sortKeyName="spend" />
                <SortHeader label="Cliques" sortKeyName="clicks" />
                <SortHeader label="Leads" sortKeyName="leads" />
                <SortHeader label="CTR" sortKeyName="ctr" />
                <SortHeader label="CPC" sortKeyName="cpc" />
                <SortHeader label="CPL" sortKeyName="cpl" />
              </tr>
            </thead>
            <tbody>
              {sortedCampaigns.map((campaign, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group">
                  <td className="font-medium text-slate-200 py-4">
                    {campaign.name || campaign.campaign_name || 'Sem nome'}
                  </td>
                  <td className="text-right text-slate-300">
                    {formatNumber(campaign.spend, 'currency')}
                  </td>
                  <td className="text-right text-slate-300">
                    {formatNumber(campaign.clicks, 'number')}
                  </td>
                  <td className="text-right">
                    <span className="text-blue-400 font-semibold">
                      {formatNumber(campaign.leads, 'number')}
                    </span>
                  </td>
                  <td className="text-right text-slate-300 font-mono text-xs">
                    {formatNumber(campaign.ctr, 'percent')}
                  </td>
                  <td className="text-right text-slate-300">
                    {formatNumber(campaign.cpc, 'currency')}
                  </td>
                  <td className="text-right">
                    <span className="text-[#f90f54] font-bold">
                      {formatNumber(campaign.cpl, 'currency')}
                    </span>
                  </td>
                </tr>
              ))}
              
              {/* Totals Row */}
              <tr className="bg-slate-800/30 font-bold">
                <td className="py-4 text-[#f90f54]">Total Geral</td>
                <td className="py-4 text-right font-mono text-white">{formatNumber(totals.spend, 'currency')}</td>
                <td className="py-4 text-right font-mono text-white">{formatNumber(totals.clicks)}</td>
                <td className="py-4 text-right font-mono text-blue-400">{formatNumber(totals.leads)}</td>
                <td className="py-4 text-right font-mono text-slate-300">{formatNumber(totalCtr, 'percent')}</td>
                <td className="py-4 text-right font-mono text-slate-300">{formatNumber(totalCpc, 'currency')}</td>
                <td className="py-4 text-right font-mono text-[#f90f54]">{formatNumber(totalCpl, 'currency')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CampaignView;
