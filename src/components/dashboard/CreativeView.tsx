import { useState } from "react";
import { LayoutGrid, List, TrendingUp, DollarSign, Target, MousePointer } from "lucide-react";
import { Card } from "@/components/ui/card";

interface CreativeViewProps {
  creatives?: any[]; // Mudado para opcional
}

const formatNumber = (value: number | undefined | null, type: 'currency' | 'number' | 'percent' = 'number'): string => {
  const safeValue = value ?? 0;
  if (type === 'currency') {
    return `R$ ${safeValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (type === 'percent') {
    return `${safeValue.toFixed(2)}%`;
  }
  return safeValue.toLocaleString('pt-BR');
};

const CreativeView = ({ creatives = [] }: CreativeViewProps) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // PROTEÇÃO: Se não for um array ou estiver vazio
  if (!Array.isArray(creatives) || creatives.length === 0) {
    return (
      <div className="p-12 text-center bg-[#1e293b]/20 rounded-2xl border border-slate-800 animate-in fade-in">
        <div className="mx-auto w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
          <LayoutGrid className="w-6 h-6 text-slate-500" />
        </div>
        <p className="text-slate-400 font-medium">Nenhum criativo identificado.</p>
        <p className="text-xs text-slate-500 mt-2">Os dados de criativos aparecerão após o processamento das planilhas ou conexão com a API.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold uppercase text-slate-400 tracking-widest">Análise de Criativos</h3>
        <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-800">
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-[#f90f54] text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-[#f90f54] text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
        {creatives.map((creative) => (
          <Card key={creative.creative_id || creative.name} className="bg-[#1e293b]/40 border-slate-800 overflow-hidden hover:border-[#f90f54]/50 transition-all group">
            <div className="aspect-video bg-slate-900 relative overflow-hidden">
              {creative.thumbnail_url ? (
                <img src={creative.thumbnail_url} alt={creative.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-700 font-bold text-xs">SEM PREVIEW</div>
              )}
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white font-bold">
                {creative.channel || 'META'}
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              <p className="text-sm font-bold text-slate-200 truncate">{creative.name || 'Criativo sem nome'}</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800/50">
                  <span className="text-[9px] uppercase text-slate-500 font-bold block mb-1">Investido</span>
                  <span className="text-xs font-mono text-slate-300">{formatNumber(creative.spend, 'currency')}</span>
                </div>
                <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800/50">
                  <span className="text-[9px] uppercase text-slate-500 font-bold block mb-1">CPL</span>
                  <span className="text-xs font-mono text-[#f90f54] font-bold">{formatNumber(creative.cpl, 'currency')}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800/50 pt-3">
                <span className="flex items-center gap-1"><MousePointer className="w-3 h-3"/> CTR: {formatNumber(creative.ctr, 'percent')}</span>
                <span className="flex items-center gap-1"><Target className="w-3 h-3"/> Leads: {creative.leads ?? 0}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CreativeView;
