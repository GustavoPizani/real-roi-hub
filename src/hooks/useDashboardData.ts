import { useState, useEffect, useCallback } from "react";
import { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import CryptoJS from "crypto-js";

const ENCRYPTION_KEY = "ads-intel-hub-2024";

// --- Interfaces ---
interface WaterfallData {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

const decrypt = (ciphertext: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch { return ""; }
};

const parseMetric = (value: any): number => {
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (value === null || value === undefined || String(value).trim() === '') return 0;

  let str = String(value).trim().replace(/[R$\s%]/g, '');

  const hasDot = str.includes('.');
  const hasComma = str.includes(',');

  // Handles formats like 1.234,56 (Brazilian) by removing dots and replacing comma
  if (hasComma && hasDot && str.lastIndexOf('.') < str.lastIndexOf(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } 
  // Handles formats like 1,234.56 (US) by removing commas
  else if (hasDot && hasComma && str.lastIndexOf(',') < str.lastIndexOf('.')) {
    str = str.replace(/,/g, '');
  }
  // Handles format with only comma as decimal separator 1234,56
  else if (hasComma) {
    str = str.replace(',', '.');
  }
  
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

export const useDashboardData = (userId: string, dateRange?: DateRange, toast?: any) => {
  const internalToast = useToast();
  const [data, setData] = useState<any>({
    temporalData: [],
    channelsData: [],
    waterfallData: [],
    campaignPerformance: [],
    adsData: [],
    kpis: { investido: 0, totalLeadsCRM: 0, totalLeadsMeta: 0, cplReal: 0, cplMeta: 0, roiReal: 0 },
    isUsingMockData: true,
    isLoading: true,
    error: null,
  });

  const fetchAPISettings = useCallback(async () => {
    if (!userId) return null;
    const { data: settings } = await supabase.from("api_settings").select("*").eq("user_id", userId);
    const decrypted: Record<string, string> = {};
    settings?.forEach((item) => { decrypted[item.setting_key] = decrypt(item.encrypted_value); });
    return decrypted;
  }, [userId]);

  const fetchCRMData = useCallback(async () => {
    if (!userId) return null;
    let query = supabase.from("crm_leads").select("*").eq("user_id", userId);
    if (dateRange?.from) query = query.gte("cadastro", dateRange.from.toISOString());
    if (dateRange?.to) query = query.lte("cadastro", dateRange.to.toISOString());
    const { data: leads } = await query;
    return leads || [];
  }, [userId, dateRange]);

  const fetchLocalMetricsData = useCallback(async () => {
    if (!userId) return [];
    console.log("Buscando dados da tabela local 'campaign_metrics' como fallback.");
    let query = supabase.from("campaign_metrics").select("*").eq("user_id", userId);
    if (dateRange?.from) query = query.gte("date", format(dateRange.from, "yyyy-MM-dd"));
    if (dateRange?.to) query = query.lte("date", format(dateRange.to, "yyyy-MM-dd"));
    const { data: metrics, error } = await query;
    if (error) {
      console.error("Erro ao buscar métricas locais como fallback:", error.message);
      return [];
    }
    return metrics || [];
  }, [userId, dateRange]);

  const fetchMetaData = useCallback(async (accessToken: string, adAccountIds: string[]) => {
    const since = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
    const until = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;
    const results = await Promise.all(
      adAccountIds.map(async (id) => {
        try {
          const { data, error } = await supabase.functions.invoke("meta-insights", {
            body: { accessToken, adAccountId: id.trim(), since, until },
          });

          console.log(`Retorno da Edge Function para a conta ${id.trim()}:`, data);

          if (error) throw error;

          if (!data || !data.adsData || data.adsData.length === 0) {
            (toast || internalToast.toast)({
              title: "Aviso de Sincronização",
              description: `A conta de anúncios ${id.trim()} não retornou dados para o período selecionado.`,
            });
          }

          return data;
        } catch (e) {
          console.error(`Erro ao buscar dados da conta ${id.trim()}:`, e);
          return null;
        }
      })
    );

    const ads: any[] = [];
    let totalSpent = 0;
    const channels: any[] = [];

    results.forEach(res => {
      if (res) {
        ads.push(...(res.adsData || []));
        totalSpent += res.kpis?.investido || 0;
        if (res.channelsData) channels.push(...res.channelsData);
      }
    });
    return { ads, totalSpent, channels };
  }, [dateRange, toast, internalToast.toast]);

  const loadDashboardData = useCallback(async () => {
      // Definição das datas no topo para garantir que existam antes de qualquer query.
      const startDate = dateRange?.from ?? subDays(new Date(), 29);
      const endDate = dateRange?.to ?? new Date();

      // Adicionado para evitar chamadas de API se o usuário estiver deslogado ou saindo.
      if (!userId) {
        setData({
          isUsingMockData: true,
          isLoading: false,
          error: "Aguardando autenticação do usuário.",
          kpis: { investido: 0, totalLeadsCRM: 0, totalLeadsMeta: 0, cplReal: 0, cplMeta: 0, roiReal: 0 },
          campaignPerformance: [],
          waterfallData: [],
          channelsData: [],
          adsData: [],
        });
        return;
      }

      setData(prev => ({ ...prev, isLoading: true }));

      try {
        const [crmLeads, decryptedSettings] = await Promise.all([
          fetchCRMData(), 
          fetchAPISettings() // Esta função já retorna o objeto descriptografado
        ]);
        
        // LOGS DE SEGURANÇA PARA O CONSOLE
        console.log("Configurações carregadas:", decryptedSettings ? "OK" : "VAZIO");

        const accessToken = decryptedSettings?.META_ACCESS_TOKEN;
        const adAccountIdsRaw = decryptedSettings?.META_AD_ACCOUNT_IDS;

        console.log("Token extraído:", accessToken ? "OK" : "VAZIO");
        console.log("Contas extraídas:", adAccountIdsRaw || "VAZIO");

        const adAccountIds = adAccountIdsRaw?.split(",").map(id => id.trim()).filter(Boolean) || [];

        let metaInfo;
        let isUsingApi = false;

        if (accessToken && adAccountIds.length > 0) {
          try {
            console.log("Priorizando API da Meta para dados em tempo real...");
            const apiResponse = await fetchMetaData(accessToken, adAccountIds);
            if (!apiResponse) throw new Error("A API da Meta não retornou dados.");
            metaInfo = apiResponse;
            isUsingApi = true;
            console.log("Dados da API da Meta carregados com sucesso.");
          } catch (apiError: any) {
            console.warn("Falha ao buscar dados da API da Meta. Usando dados locais como fallback.", apiError.message);
          }
        }
        
        if (!isUsingApi) {
          const localMetrics = await fetchLocalMetricsData();
          const campaignsMap: Record<string, any> = {};
          (localMetrics || []).forEach(metric => {
            const name = normalize(metric.campaign_name);
            if (!campaignsMap[name]) {
              campaignsMap[name] = { campaignName: name, spend: 0, conversions: 0 };
            }
            campaignsMap[name].spend += parseMetric(metric.spend);
            campaignsMap[name].conversions += parseMetric(metric.leads);
          });
          const ads = Object.values(campaignsMap);
          const totalSpent = ads.reduce((sum, ad) => sum + parseMetric(ad.spend), 0);
          metaInfo = { ads, totalSpent, channels: [] };
        }

        // --- SINCRONIZAÇÃO DE CRIATIVOS (VEM DA TABELA) ---
        const { data: creativeMetrics, error: creativeMetricsError } = await supabase
          .from("campaign_metrics")
          .select("campaign_name, ad_id, ad_name, creative_id, creative_name, thumbnail_url, spend, leads, cpl, ctr, impressions, clicks, reach, frequency")
          .eq("user_id", userId)
          .gte("date", format(startDate, "yyyy-MM-dd"))
          .lte("date", format(endDate, "yyyy-MM-dd"));

        console.log('Dados brutos do banco (campaign_metrics):', creativeMetrics);

        if (creativeMetricsError) {
          console.error("Erro ao buscar métricas de criativos:", creativeMetricsError.message);
        }

        const creativesMap: Record<string, any> = {};
        (creativeMetrics || []).forEach(metric => {
          // Prioriza o ad_id da API (mais confiável), com fallback para dados de upload
          const key = metric.ad_id || metric.creative_id || metric.ad_name;
          if (!key) return;

          if (!creativesMap[key]) {
            creativesMap[key] = {
              // Mapeia o ad_id para o creative_id que a view espera como chave
              creative_id: metric.ad_id || metric.creative_id,
              name: metric.ad_name || metric.creative_name,
              thumbnail_url: metric.thumbnail_url,
              spend: 0, leads: 0, impressions: 0, clicks: 0,
            };
          }
          
          creativesMap[key].spend += parseMetric(metric.spend);
          creativesMap[key].leads += parseMetric(metric.leads);
          creativesMap[key].impressions += parseMetric(metric.impressions);
          creativesMap[key].clicks += parseMetric(metric.clicks);
        });

        const adsData = Object.values(creativesMap).map((c: any) => ({
          ...c,
          spend: parseMetric(c.spend),
          leads: parseMetric(c.leads),
          cpl: parseMetric(c.leads) > 0 ? parseMetric(c.spend) / parseMetric(c.leads) : 0,
          ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        })).sort((a, b) => b.spend - a.spend);

        // --- 3. PERFORMANCE POR PROJETO (UNIFICAÇÃO TOTAL) ---
        const campaignsMap: Record<string, any> = {};

        // Função auxiliar para normalizar nomes e evitar duplicidade por erro de digitação
        const normalize = (name: string) => (name || "Sem Campanha").toUpperCase().trim().replace(/\s+/g, ' ');

        // Passo A: Agrega dados da tabela campaign_metrics (fonte de dados de performance)
        (creativeMetrics || []).forEach(metric => {
          console.log(`Somando para Campanha '${normalize(metric.campaign_name)}': Spend: ${metric.spend}, Leads: ${metric.leads}, Clicks: ${metric.clicks}`);
          const name = normalize(metric.campaign_name);
          if (!campaignsMap[name]) {
            campaignsMap[name] = { 
              name, 
              spend: 0, 
              leads: 0, // CRM leads
              leadsMeta: 0, // Meta leads
              impressions: 0,
              clicks: 0,
              qualified: 0, 
              sales: 0 
            };
          }
          campaignsMap[name].spend += parseMetric(metric.spend);
          campaignsMap[name].leadsMeta += parseMetric(metric.leads);
          campaignsMap[name].impressions += parseMetric(metric.impressions);
          campaignsMap[name].clicks += parseMetric(metric.clicks);
        });

        // Passo B: Agrega dados do CRM (Mesmo que a campanha não tenha gasto na Meta no período)
        crmLeads?.forEach((lead: any) => {
          const name = normalize(lead.campanha_nome);
          
          if (!campaignsMap[name]) {
            campaignsMap[name] = { name, spend: 0, leads: 0, leadsMeta: 0, impressions: 0, clicks: 0, qualified: 0, sales: 0 };
          }
          
          campaignsMap[name].leads += 1;
          const status = (lead.situacao_atendimento || '').toLowerCase();
          
          // Contabilização de leads qualificados e vendas conforme status do CRM
          if (['schedule', 'visita', 'proposta', 'purchase', 'venda', 'submitapplication'].some(s => status.includes(s))) {
            campaignsMap[name].qualified += 1;
          }
          if (status.includes('venda') || status.includes('purchase')) {
            campaignsMap[name].sales += 1;
          }
        });

        // Passo C: Transforma o Objeto em Array e calcula métricas finais
        const campaignPerformance = Object.values(campaignsMap).map((m: any) => ({
          ...m,
          cplReal: m.leads > 0 ? m.spend / m.leads : 0,
          cplMeta: m.leadsMeta > 0 ? m.spend / m.leadsMeta : 0,
          cpc: m.clicks > 0 ? m.spend / m.clicks : 0,
          ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
          cpm: m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0,
          // Cálculo de qualidade para o badge "REVISAR/ESTÁVEL/OTIMIZADO"
          status: m.leads > 0 && (m.qualified / m.leads) > 0.25 ? 'OTIMIZADO' : 
                  m.leads > 0 && (m.qualified / m.leads) > 0.15 ? 'ESTÁVEL' : 'REVISAR'
        })).sort((a, b) => b.spend - a.spend); // Ordena pelas campanhas que mais gastaram

        // --- 4. KPIs SUPERIORES (Sincronizados) ---
        const totalMetrics = (creativeMetrics || []).reduce((acc, m) => {
          acc.spend += parseMetric(m.spend);
          acc.impressions += parseMetric(m.impressions);
          acc.clicks += parseMetric(m.clicks);
          acc.leadsMeta += parseMetric(m.leads);
          acc.reach += parseMetric(m.reach); // Novo: somando alcance
          acc.freqSum += parseMetric(m.frequency) * parseMetric(m.impressions); // Para média ponderada
          return acc;
        }, { spend: 0, impressions: 0, clicks: 0, leadsMeta: 0, reach: 0, freqSum: 0 });

        const investment = totalMetrics.spend;
        const totalLeadsMeta = totalMetrics.leadsMeta;
        const avgFrequency = totalMetrics.impressions > 0 ? totalMetrics.freqSum / totalMetrics.impressions : 0;

        // Métrica Real vinda do CRM
        const totalLeadsCRM = crmLeads?.length || 0;
        const totalSalesCRM = crmLeads?.filter(l => l.situacao_atendimento?.toLowerCase().includes('venda')).length || 0;

        // Cálculos de CPL
        const cplReal = totalLeadsCRM > 0 ? investment / totalLeadsCRM : 0;
        const cplMeta = totalLeadsMeta > 0 ? investment / totalLeadsMeta : 0;

        // --- 5. FUNIL WATERFALL (Sincronizado com CRM) ---
        const totalVisitsCRM = crmLeads?.filter(l => 
          l.situacao_atendimento?.toLowerCase().includes('schedule') || 
          l.situacao_atendimento?.toLowerCase().includes('visita')
        ).length || 0;

        const waterfallData: WaterfallData[] = [
          { name: 'LEADS META (API)', value: totalLeadsMeta, percentage: 100, color: 'bg-blue-600' },
          { name: 'LEADS CRM (REAL)', value: totalLeadsCRM, percentage: totalLeadsMeta > 0 ? (totalLeadsCRM / totalLeadsMeta) * 100 : 0, color: 'bg-[#f90f54]' },
          { name: 'VISITAS AGENDADAS', value: totalVisitsCRM, percentage: totalLeadsCRM > 0 ? (totalVisitsCRM / totalLeadsCRM) * 100 : 0, color: 'bg-[#0088FE]' },
          { name: 'VENDAS', value: totalSalesCRM, percentage: totalLeadsCRM > 0 ? (totalSalesCRM / totalLeadsCRM) * 100 : 0, color: 'bg-[#00C49F]' }
        ];

        setData({
          waterfallData,
          campaignPerformance,
          adsData,
          kpis: {
            spend: investment,
            impressions: totalMetrics.impressions,
            clicks: totalMetrics.clicks,
            leads: totalLeadsMeta, // Este alimenta a "Conversão" no overview
            ctr: totalMetrics.impressions > 0 ? (totalMetrics.clicks / totalMetrics.impressions) * 100 : 0,
            cpc: totalMetrics.clicks > 0 ? investment / totalMetrics.clicks : 0,
            cpm: totalMetrics.impressions > 0 ? (investment / totalMetrics.impressions) * 1000 : 0,
            cpl: cplMeta, // CPL da aba campanhas
            reach: totalMetrics.reach, // Alimentando o card de Alcance
            frequency: avgFrequency, // Alimentando o card de Frequência
            totalLeadsCRM,
            cplReal,
            roiReal: investment > 0 ? (totalSalesCRM * 5000 / investment) : 0 
          },
          isUsingMockData: !isUsingApi,
          isLoading: false,
          error: null,
        });

      } catch (error: any) {
        console.error("Erro Dashboard Data:", error);
        setData(prev => ({ ...prev, isLoading: false, error: "Erro ao processar dados do dashboard." }));
      }
    }, [userId, dateRange, fetchAPISettings, fetchCRMData, fetchMetaData, fetchLocalMetricsData, toast, internalToast.toast]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  return {
    ...data,
    refetch: loadDashboardData,
  };
};
