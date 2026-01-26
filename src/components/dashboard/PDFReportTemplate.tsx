import { 
  DollarSign, MousePointer, Hash, Percent, Users, Target, Eye, 
  MousePointerClick, Globe, Activity, Bot, Calendar
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PDFReportTemplateProps {
  data: any[]; // Todas as campanhas
  dateRange: { from: Date; to: Date } | undefined;
}

// Card simples para o PDF (Estilo Clean/Light)
const ReportCard = ({ title, value, icon: Icon, formatType }: any) => {
  const formattedValue = () => {
    if (formatType === 'currency') return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
    if (formatType === 'percentage') return `${(value || 0).toFixed(2)}%`;
    if (formatType === 'decimal') return (value || 0).toFixed(2);
    return new Intl.NumberFormat("pt-BR").format(value || 0);
  };

  return (
    <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm flex flex-col justify-between h-24">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase">{title}</span>
        <Icon className="w-4 h-4 text-[#f90f54]" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{formattedValue()}</p>
    </div>
  );
};

export const PDFReportTemplate = ({ data, dateRange }: PDFReportTemplateProps) => {
  
  // Função para calcular métricas de um conjunto de dados
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

  // 1. Dados da Página 1 (Visão Geral - Todos os Projetos)
  const overviewMetrics = calculateMetrics(data);

  // 2. Lista de Campanhas (Para as páginas 2, 3, 4...)
  // Agrupar dados por nome de campanha para garantir unicidade nas páginas
  const uniqueCampaigns = Array.from(new Set(data.map(d => d.campaign_name))).map(name => {
    const campaignData = data.filter(d => d.campaign_name === name);
    return {
      name: name,
      metrics: calculateMetrics(campaignData)
    };
  });

  const formatDate = (date?: Date) => date ? format(date, "dd 'de' MMM, yyyy", { locale: ptBR }) : "";

  // Componente de Página (Reutilizável)
  const ReportPage = ({ title, subTitle, metrics, isOverview = false }: any) => (
    <div className="w-[210mm] h-[297mm] bg-white text-slate-900 p-10 flex flex-col relative page-break-after-always">
      {/* Cabeçalho */}
      <div className="flex justify-between items-start border-b-4 border-[#f90f54] pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Relatório de Performance</h1>
          <h2 className="text-xl text-[#f90f54] font-medium">{title}</h2>
          <p className="text-sm text-slate-500 mt-2">{subTitle}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-700 flex items-center justify-end gap-2">
            <Calendar className="w-4 h-4" />
            {formatDate(dateRange?.from)} - {formatDate(dateRange?.to)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Gerado via Real ROI Hub</p>
        </div>
      </div>

      {/* Grade de KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <ReportCard title="Investimento" value={metrics.spend} icon={DollarSign} formatType="currency" />
        <ReportCard title="CPL" value={metrics.cpl} icon={Users} formatType="currency" />
        <ReportCard title="Leads" value={metrics.leads} icon={Target} formatType="number" />
        <ReportCard title="CTR" value={metrics.ctr} icon={Percent} formatType="percentage" />
        
        <ReportCard title="Impressões" value={metrics.impressions} icon={Eye} formatType="number" />
        <ReportCard title="Cliques" value={metrics.clicks} icon={MousePointerClick} formatType="number" />
        <ReportCard title="CPC" value={metrics.cpc} icon={MousePointer} formatType="currency" />
        <ReportCard title="CPM" value={metrics.cpm} icon={Hash} formatType="currency" />
        
        <ReportCard title="Alcance" value={metrics.reach} icon={Globe} formatType="number" />
        <ReportCard title="Frequência" value={metrics.frequency} icon={Activity} formatType="decimal" />
      </div>

      {/* Sessão de Gráfico (Simulada para PDF para garantir renderização) */}
      <div className="mb-8 border border-slate-200 rounded-xl p-6 bg-slate-50">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#f90f54]" />
          Distribuição de Investimento e Resultados
        </h3>
        {/* Barras de progresso simples como gráfico estático */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Investimento (R$)</span>
              <span className="font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.spend)}</span>
            </div>
            <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-[#f90f54]" style={{ width: '100%' }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Eficiência de Leads (CPL Base R$ 50,00)</span>
              <span className="font-bold">R$ {metrics.cpl.toFixed(2)}</span>
            </div>
            <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
              <div 
                className={`h-full ${metrics.cpl < 50 ? 'bg-green-500' : 'bg-red-500'}`} 
                style={{ width: `${Math.min((metrics.cpl / 100) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Sessão de Insights da IA */}
      <div className="mt-auto border-t border-slate-200 pt-6">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" />
            Análise Estratégica (IA)
          </h3>
          <p className="text-sm text-blue-800 leading-relaxed">
            {metrics.cpl > 50 
              ? `Atenção para esta campanha: O Custo por Lead (R$ ${metrics.cpl.toFixed(2)}) está acima da média de mercado. O CTR de ${metrics.ctr.toFixed(2)}% indica possível fadiga dos criativos. Recomendamos testar novas imagens imediatamente.`
              : metrics.cpl === 0 
                ? "Esta campanha ainda não gerou conversões. Verifique se o pixel está ativo e se houve investimento suficiente para sair da fase de aprendizado."
                : `Desempenho Saudável: O CPL de R$ ${metrics.cpl.toFixed(2)} está excelente. Com um CTR de ${metrics.ctr.toFixed(2)}%, seus anúncios estão atraindo o público certo. Sugerimos escala gradual de 20% no orçamento.`
            }
          </p>
        </div>
      </div>

      {/* Rodapé */}
      <div className="absolute bottom-6 left-10 right-10 text-center border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-400">Relatório gerado automaticamente por Real ROI Hub Intelligence</p>
      </div>
    </div>
  );

  return (
    <div id="pdf-report-container" className="fixed top-0 left-0 -z-50 bg-gray-200">
      {/* Página 1: Visão Geral */}
      <div id="report-page-1">
        <ReportPage 
          title="Visão Geral (Todos os Projetos)" 
          subTitle="Consolidado de todas as campanhas ativas no período."
          metrics={overviewMetrics}
          isOverview={true}
        />
      </div>

      {/* Páginas 2+: Campanhas Individuais */}
      {uniqueCampaigns.map((camp, index) => (
        <div key={index} id={`report-page-${index + 2}`}>
          <ReportPage 
            title={`Campanha: ${camp.name}`} 
            subTitle="Análise detalhada de performance individual."
            metrics={camp.metrics}
          />
        </div>
      ))}
    </div>
  );
};