import React from "react";
import { 
  DollarSign, MousePointer, Hash, Percent, Users, Target, Eye, 
  MousePointerClick, Globe, Activity, Bot, Calendar
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PDFReportTemplateProps {
  data: any[]; 
  dateRange: { from: Date; to: Date } | undefined;
}

// LÓGICA DO ANALISTA SÊNIOR (SIMULADA PARA PDF)
const getSmartAnalysis = (metrics: any) => {
  const { cpl, ctr, spend, leads } = metrics;
  const analysis = [];

  if (leads === 0 && spend > 100) {
    analysis.push("⚠️ PROBLEMA CRÍTICO: Campanha consumindo verba sem conversões. Revisar Landing Page e Pixel.");
    analysis.push("👉 AÇÃO: Pausar e verificar funil.");
  } else if (cpl > 50) {
    analysis.push(`⚠️ ALERTA DE CUSTO: CPL de R$ ${cpl.toFixed(2)} está alto.`);
    if (ctr < 1) {
        analysis.push(`📉 DIAGNÓSTICO: CTR baixo (${ctr.toFixed(2)}%). Criativos não estão conectando.`);
        analysis.push("👉 AÇÃO: Testar novos criativos imediatamente.");
    } else {
        analysis.push(`✅ DIAGNÓSTICO: Tráfego qualificado (CTR ${ctr.toFixed(2)}%), mas baixa conversão.`);
        analysis.push("👉 AÇÃO: Otimizar oferta e velocidade do site.");
    }
  } else if (cpl > 0 && cpl <= 20) {
    analysis.push(`🚀 OPORTUNIDADE: CPL excelente (R$ ${cpl.toFixed(2)}).`);
    analysis.push("👉 AÇÃO: Escalar orçamento em 20% mantendo o criativo campeão.");
  } else {
    analysis.push("ℹ️ ESTABILIDADE: Performance dentro do esperado.");
    analysis.push("👉 AÇÃO: Manter e iniciar testes A/B secundários.");
  }

  return analysis;
};

const ReportCard = ({ title, value, icon: Icon, formatType }: any) => {
  const formattedValue = () => {
    if (formatType === 'currency') return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
    if (formatType === 'percentage') return `${(value || 0).toFixed(2)}%`;
    if (formatType === 'decimal') return (value || 0).toFixed(2);
    return new Intl.NumberFormat("pt-BR").format(value || 0);
  };

  return (
    <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm flex flex-col justify-between h-20">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase">{title}</span>
        <Icon className="w-3 h-3 text-[#f90f54]" />
      </div>
      <p className="text-xl font-bold text-slate-900">{formattedValue()}</p>
    </div>
  );
};

export const PDFReportTemplate = ({ data, dateRange }: PDFReportTemplateProps) => {
  
  const calculateMetrics = (dataset: any[]) => {
    const totals = dataset.reduce((acc, curr) => ({
      spend: acc.spend + (curr.spend || 0),
      impressions: acc.impressions + (curr.impressions || 0),
      clicks: acc.clicks + (curr.clicks || 0),
      leads: acc.leads + (curr.leads || 0),
      reach: acc.reach + (curr.reach || 0),
    }), { spend: 0, impressions: 0, clicks: 0, leads: 0, reach: 0 });

    return {
      ...totals,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
      cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      cpl: totals.leads > 0 ? totals.spend / totals.leads : 0,
      frequency: totals.reach > 0 ? totals.impressions / totals.reach : 0,
    };
  };

  const overviewMetrics = calculateMetrics(data);

  const uniqueCampaigns = Array.from(new Set(data.map(d => d.campaign_name))).filter(Boolean).map(name => {
    const campaignData = data.filter(d => d.campaign_name === name);
    return {
      name: name,
      metrics: calculateMetrics(campaignData)
    };
  });

  const formatDate = (date?: Date) => date ? format(date, "dd MMM yyyy", { locale: ptBR }) : "";

  const ReportPage = ({ title, subTitle, metrics }: any) => {
    const smartAnalysis = getSmartAnalysis(metrics);

    return (
      <div className="w-[210mm] h-[297mm] bg-white text-slate-900 p-8 flex flex-col relative page-break-after-always">
        {/* Header Compacto */}
        <div className="flex justify-between items-start border-b-4 border-[#f90f54] pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Relatório de Performance</h1>
            <h2 className="text-lg text-[#f90f54] font-medium truncate max-w-[400px]">{title}</h2>
            <p className="text-xs text-slate-500 mt-1">{subTitle}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-700 flex items-center justify-end gap-2">
              <Calendar className="w-3 h-3" />
              {formatDate(dateRange?.from)} - {formatDate(dateRange?.to)}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">Real ROI Hub Intelligence</p>
          </div>
        </div>

        {/* Grade de KPIs */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <ReportCard title="Investimento" value={metrics.spend} icon={DollarSign} formatType="currency" />
          <ReportCard title="CPL" value={metrics.cpl} icon={Users} formatType="currency" />
          <ReportCard title="Leads" value={metrics.leads} icon={Target} formatType="number" />
          <ReportCard title="CTR" value={metrics.ctr} icon={Percent} formatType="percentage" />
          
          <ReportCard title="Impressões" value={metrics.impressions} icon={Eye} formatType="number" />
          <ReportCard title="Cliques" value={metrics.clicks} icon={MousePointerClick} formatType="number" />
          <ReportCard title="CPC" value={metrics.cpc} icon={MousePointer} formatType="currency" />
          <ReportCard title="Alcance" value={metrics.reach} icon={Globe} formatType="number" />
        </div>

        {/* ANÁLISE AUTOMÁTICA (Movida para cima para destaque) */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-5 shadow-sm mb-6">
          <h3 className="text-md font-bold text-blue-900 mb-2 flex items-center gap-2">
            <Bot className="w-4 h-4 text-blue-600" />
            Insights e Recomendações
          </h3>
          <div className="space-y-1.5">
              {smartAnalysis.map((line: string, i: number) => (
                  <p key={i} className="text-xs text-blue-800 leading-relaxed font-medium border-l-2 border-blue-300 pl-2">
                      {line}
                  </p>
              ))}
          </div>
        </div>

        {/* Gráfico Visual */}
        <div className="flex-1 border border-slate-200 rounded-xl p-5 bg-slate-50 mb-8">
          <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#f90f54]" />
            Eficiência do Funil
          </h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Investimento</span>
                <span className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.spend)}</span>
              </div>
              <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#f90f54]" style={{ width: '100%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Saúde do CPL (Meta: R$ 40,00)</span>
                <span className={`font-bold ${metrics.cpl > 40 ? 'text-red-500' : 'text-green-600'}`}>
                    R$ {metrics.cpl.toFixed(2)}
                </span>
              </div>
              <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${metrics.cpl <= 40 ? 'bg-green-500' : 'bg-red-500'}`} 
                  style={{ width: `${Math.min((metrics.cpl / 80) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="text-center border-t border-slate-100 pt-4 mt-auto">
          <p className="text-[10px] text-slate-400">Relatório Confidencial - Gerado por Real ROI Hub Intelligence</p>
        </div>
      </div>
    );
  };

  return (
    <div id="pdf-report-container" className="fixed top-0 left-0 -z-50 bg-gray-200">
      <div id="report-page-1">
        <ReportPage 
          title="Visão Geral" 
          subTitle="Consolidado de todas as campanhas."
          metrics={overviewMetrics}
        />
      </div>
      {uniqueCampaigns.map((camp, index) => (
        <div key={index} id={`report-page-${index + 2}`}>
          <ReportPage 
            title={`Campanha: ${camp.name}`} 
            subTitle="Performance detalhada."
            metrics={camp.metrics}
          />
        </div>
      ))}
    </div>
  );
};