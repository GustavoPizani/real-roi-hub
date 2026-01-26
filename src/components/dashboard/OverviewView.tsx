import { useEffect, useState, useRef } from "react";
import { TemporalChart } from "@/components/dashboard/TemporalChart";
import { 
  DollarSign, MousePointer, Hash, Percent, Users, Target, Eye, 
  MousePointerClick, Globe, Activity, Bot, TrendingUp, AlertTriangle, CheckCircle, TrendingDown, Loader2, RefreshCcw, Bug
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import CryptoJS from "crypto-js";

const KPICard = ({ title, value, icon: Icon, trend, trendUp, format, isLoading, invertTrendColor }: any) => {
  const formattedValue = () => {
    if (format === 'currency') return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
    if (format === 'percentage') return `${(value || 0).toFixed(2)}%`;
    if (format === 'decimal') return (value || 0).toFixed(2);
    return new Intl.NumberFormat("pt-BR").format(value || 0);
  };
  
  if (isLoading) return <div className="bg-[#1e293b]/40 border border-slate-700/50 p-4 rounded-xl h-24 animate-pulse" />;

  const isPositive = invertTrendColor ? !trendUp : trendUp;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const trendColor = isPositive ? "text-green-400" : "text-red-400";

  return (
    <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 p-4 rounded-xl hover:border-[#f90f54]/30 transition-all group flex flex-col justify-between h-full">
      <div className="flex justify-between items-start">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate mr-1">{title}</span>
        <Icon className="w-4 h-4 text-[#f90f54] opacity-70 group-hover:opacity-100" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white tracking-tight truncate">{formattedValue()}</p>
        {trend && <div className="flex items-center gap-1 mt-0.5"><TrendIcon className={`w-3 h-3 ${trendColor}`} /><span className={`text-[10px] ${trendColor}`}>{trend}</span></div>}
      </div>
    </div>
  );
};

interface OverviewViewProps {
  data: any[]; 
  dailyData?: any[]; 
  isLoading: boolean;
}

export const OverviewView = ({ data, dailyData, isLoading }: OverviewViewProps) => {
  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const lastDataRef = useRef<string>("");

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

  useEffect(() => {
    const loadInsights = async () => {
      const currentDataSignature = JSON.stringify(data.map(d => d.campaign_name + d.spend));
      
      if ((!data || data.length === 0 || isLoading) && retryCount === 0) return;
      if (currentDataSignature === lastDataRef.current && retryCount === 0 && aiInsights.length > 0) return;
      
      lastDataRef.current = currentDataSignature;
      if (retryCount === 0) setAiInsights([]); 
      setIsAiLoading(true);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: settings } = await supabase
          .from("api_settings")
          .select("encrypted_value")
          .eq("user_id", user.id)
          .eq("setting_key", "GEMINI_API_KEY")
          .maybeSingle();

        if (!settings) {
          setAiInsights([{ type: 'info', text: 'Configure sua chave Groq em /settings.' }]);
          setIsAiLoading(false);
          return;
        }

        const bytes = CryptoJS.AES.decrypt(settings.encrypted_value, "ads-intel-hub-2024");
        const apiKey = bytes.toString(CryptoJS.enc.Utf8);

        if (!apiKey) throw new Error("Chave inválida");

        const { data: responseData, error } = await supabase.functions.invoke('ai-chat', {
          body: { apiKey, data }
        });

        if (error) throw error;
        
        // --- TRATAMENTO CORRIGIDO ---
        let insights = responseData;
        if (typeof responseData === 'string') {
            try { insights = JSON.parse(responseData); } catch { insights = []; }
        }

        // Se a IA devolver { insights: [...] }, extraímos o array
        if (insights && !Array.isArray(insights) && insights.insights) {
            insights = insights.insights;
        }
        
        if (!Array.isArray(insights)) {
            if (insights?.error) {
                insights = [{ type: 'danger', text: "Erro IA: " + insights.error }];
            } else if (insights?.type) {
                insights = [insights]; 
            } else {
                insights = [];
            }
        }
        
        setAiInsights(insights);

      } catch (error: any) {
        console.error("Erro IA:", error);
        setAiInsights([{ type: 'danger', text: 'Erro ao processar IA.' }]);
      } finally {
        setIsAiLoading(false);
      }
    };

    loadInsights();
  }, [data, isLoading, retryCount]);

  const handleRetry = () => setRetryCount(prev => prev + 1);

  const cards = [
    { title: "Investimento", value: totals.spend, icon: DollarSign, format: 'currency' },
    { title: "Leads", value: totals.leads, icon: Target, format: 'number' },
    { title: "CPL", value: cpl, icon: Users, format: 'currency', invert: true },
    { title: "CTR", value: ctr, icon: Percent, format: 'percentage' },
    { title: "CPC", value: cpc, icon: MousePointer, format: 'currency', invert: true },
    { title: "Impressões", value: totals.impressions, icon: Eye, format: 'number' },
    { title: "Cliques", value: totals.clicks, icon: MousePointerClick, format: 'number' },
    { title: "CPM", value: cpm, icon: Hash, format: 'currency', invert: true },
    { title: "Alcance", value: totals.reach, icon: Globe, format: 'number' },
    { title: "Frequência", value: frequency, icon: Activity, format: 'decimal' },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-full pb-6">
      <div className="xl:col-span-3 flex flex-col gap-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
        <div className="flex-1 min-h-[400px]">
          <TemporalChart data={dailyData || []} isLoading={isLoading} />
        </div>
      </div>

      <div className="xl:col-span-1 h-full min-h-[500px]">
        <Card className="bg-[#1e293b]/40 border-slate-700/50 backdrop-blur-md h-full flex flex-col shadow-xl border-l-4 border-l-[#f90f54]">
          <CardHeader className="border-b border-slate-700/50 pb-4 bg-slate-900/30 flex flex-row justify-between items-center">
            <div>
                <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Bot className="w-6 h-6 text-[#f90f54]" />
                Analista Sênior
                </CardTitle>
                <p className="text-xs text-slate-400">Insights Groq/Meta</p>
            </div>
            {!isAiLoading && (
                <Button variant="ghost" size="icon" onClick={handleRetry} title="Forçar Análise">
                    <RefreshCcw className="w-4 h-4 text-slate-400 hover:text-white" />
                </Button>
            )}
          </CardHeader>
          
          <CardContent className="pt-6 flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {isAiLoading || isLoading ? (
               <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-70">
                 <Loader2 className="w-10 h-10 text-[#f90f54] animate-spin" />
                 <p className="text-sm text-slate-300 animate-pulse">Analisando...</p>
               </div>
            ) : (
              <>
                {Array.isArray(aiInsights) && aiInsights.map((insight: any, idx: number) => (
                  <div key={idx} className="flex flex-col gap-2 p-4 rounded-xl bg-slate-900/60 border border-slate-800 transition-all hover:border-[#f90f54]/40 hover:bg-slate-900/80 shadow-sm">
                    <div className="flex items-center gap-2">
                      {insight.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                      {insight.type === 'danger' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                      {insight.type === 'success' && <TrendingUp className="w-4 h-4 text-green-500" />}
                      {insight.type === 'info' && <CheckCircle className="w-4 h-4 text-blue-500" />}
                      
                      <span className={`text-xs font-bold uppercase tracking-wider ${
                        insight.type === 'warning' ? 'text-yellow-500' :
                        insight.type === 'danger' ? 'text-red-500' :
                        insight.type === 'success' ? 'text-green-500' : 'text-blue-500'
                      }`}>
                        {insight.type === 'success' ? 'Oportunidade' : insight.type === 'danger' ? 'Crítico' : insight.type === 'warning' ? 'Atenção' : 'Info'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed font-medium pl-1">
                      {insight.text}
                    </p>
                  </div>
                ))}
                
                {(!aiInsights || aiInsights.length === 0) && (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                    <Bug className="w-10 h-10 mb-2 opacity-20" />
                    <p className="text-sm">Sem análise disponível.</p>
                    <Button variant="outline" size="sm" onClick={handleRetry} className="border-slate-700 hover:bg-slate-800 mt-2">
                        Tentar Novamente
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};