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
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === 'number') return value;

  const sValue = String(value)
    .replace(/R\$\s?/g, '')
    .trim();

  // Se o valor contém vírgula, tratamos como formato brasileiro (ex: "1.234,56").
  // Removemos os pontos de milhar e substituímos a vírgula decimal por ponto.
  if (sValue.includes(',')) {
    const num = parseFloat(sValue.replace(/\./g, '').replace(',', '.'));
    return isNaN(num) ? 0 : num;
  }

  // Se não há vírgula, pode ser um formato americano (ex: "1,234.56") ou um número simples.
  // Removemos as vírgulas de milhar para garantir o parse correto.
  const num = parseFloat(sValue.replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
};

export const useDashboardData = (userId: string, dateRange?: DateRange, toast?: any, selectedCampaignFilter?: string) => {
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

  const fetchAPISettings = useCallback(async () => { // No changes needed here
    if (!userId) return null;
    const { data: settings } = await supabase.from("api_settings").select("*").eq("user_id", userId);
    const decrypted: Record<string, string> = {};
    settings?.forEach((item) => { decrypted[item.setting_key] = decrypt(item.encrypted_value); });
    return decrypted;
  }, [userId]);

  const fetchCRMData = useCallback(async () => { // No changes needed here
    if (!userId) return null;
    let query = supabase.from("crm_leads").select("*").eq("user_id", userId);
    if (dateRange?.from) query = query.gte("cadastro", dateRange.from.toISOString());
    if (dateRange?.to) query = query.lte("cadastro", dateRange.to.toISOString());
    const { data: leads } = await query;
    return leads || [];
  }, [userId, dateRange]);
  
  const fetchLocalMetricsData = useCallback(async (selectedCampaignFilter?: string) => {
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
    if (selectedCampaignFilter && selectedCampaignFilter !== "all") {
      const normalize = (name: string) => (name || "Sem Campanha").trim().replace(/\s+/g, ' ');
      return metrics.filter(metric => normalize(metric.campaign_name) === normalize(selectedCampaignFilter));
    }
    return metrics || [];
  }, [userId, dateRange]);

  const fetchMetaData = useCallback(async (accessToken: string, adAccountIds: string[], selectedCampaignFilter?: string) => {
    const since = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
    const until = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;
    const results = await Promise.all(
      adAccountIds.map(async (id) => {
        try {
          const { data, error } = await supabase.functions.invoke("meta-insights", {
            body: { accessToken, adAccountId: id.trim(), since, until, selectedCampaign: selectedCampaignFilter },
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

    results.forEach(res => { // No changes needed here, filtering happens in edge function
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

      // Função auxiliar para normalizar nomes e evitar duplicidade por erro de digitação
      const normalize = (name: string) => (name || "Sem Campanha").trim().replace(/\s+/g, ' ');

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
            const apiResponse = await fetchMetaData(accessToken, adAccountIds, selectedCampaignFilter);
            if (!apiResponse || !apiResponse.ads) throw new Error("A API da Meta não retornou dados.");
            metaInfo = apiResponse;
            isUsingApi = true;
            console.log("Dados da API da Meta carregados com sucesso.");
          } catch (apiError: any) {
            console.warn("Falha ao buscar dados da API da Meta. Usando dados locais como fallback.", apiError.message);
          }
        }
        
        if (!isUsingApi || !metaInfo.ads || metaInfo.ads.length === 0) {
          const localMetrics = await fetchLocalMetricsData(selectedCampaignFilter);
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
        // Nota: Usamos ad_name e creative_name como identificadores (não ad_id/creative_id)
        let { data: creativeMetrics, error: creativeMetricsError } = await supabase
          .from("campaign_metrics")
          .select("campaign_name, ad_set_name, ad_name, creative_name, thumbnail_url, spend, leads, cpl, ctr, impressions, clicks, reach, frequency")
          .eq("user_id", userId)
          .gte("date", format(startDate, "yyyy-MM-dd"))
          .lte("date", format(endDate, "yyyy-MM-dd"));

        if (selectedCampaignFilter && selectedCampaignFilter !== "all" && creativeMetrics) {
          creativeMetrics = creativeMetrics.filter(metric => normalize(metric.campaign_name) === normalize(selectedCampaignFilter));
        }

        console.log('Dados brutos do banco (campaign_metrics):', creativeMetrics);

        if (creativeMetricsError) {
          console.error("Erro ao buscar métricas de criativos:", creativeMetricsError.message);
        }

        const creativesMap: Record<string, any> = {};
        (creativeMetrics || []).forEach(metric => {
          // Usa ad_name ou creative_name como chave única
          const key = metric.ad_name || metric.creative_name || 'unknown';
          if (key === 'unknown') return;

          if (!creativesMap[key]) {
            creativesMap[key] = {
              creative_id: key,
              name: metric.ad_name || metric.creative_name,
              thumbnail_url: metric.thumbnail_url,
              campaign_name: metric.campaign_name,
              spend: 0, leads: 0, impressions: 0, clicks: 0,
            };
          }
          
          // Soma as métricas garantindo que sejam números
          creativesMap[key].spend += parseMetric(metric.spend);
          creativesMap[key].leads += parseMetric(metric.leads);
          creativesMap[key].impressions += parseMetric(metric.impressions);
          creativesMap[key].clicks += parseMetric(metric.clicks);
        });

        let adsData = Object.values(creativesMap).map((c: any) => ({
          ...c,
          spend: parseMetric(c.spend),
          leads: parseMetric(c.leads),
          cpl: parseMetric(c.leads) > 0 ? Math.round((parseMetric(c.spend) / parseMetric(c.leads)) * 100) / 100 : 0,
          ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        })).sort((a, b) => b.spend - a.spend);


        // --- 3. PERFORMANCE POR PROJETO (UNIFICAÇÃO TOTAL) ---
        const campaignsMapForPerformance: Record<string, any> = {};

        // Passo A: Agrega dados da tabela campaign_metrics (fonte de dados de performance)
        (creativeMetrics || []).forEach(metric => {
          const campaignName = metric.campaign_name || metric.ad_name || 'Sem Nome';
          const name = normalize(campaignName);
          console.log(`Somando para Campanha '${name}': Spend: ${metric.spend}, Leads: ${metric.leads}, Clicks: ${metric.clicks}`);
          
          if (!campaignsMapForPerformance[name]) {
            campaignsMapForPerformance[name] = { 
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
          campaignsMapForPerformance[name].spend += parseMetric(metric.spend);
          campaignsMapForPerformance[name].leadsMeta += parseMetric(metric.leads);
          campaignsMapForPerformance[name].impressions += parseMetric(metric.impressions);
          campaignsMapForPerformance[name].clicks += parseMetric(metric.clicks);
        });

        // Passo B: Agrega dados do CRM (Mesmo que a campanha não tenha gasto na Meta no período)
        crmLeads?.forEach((lead: any) => {
          const name = normalize(lead.campanha_nome);
          
          if (!campaignsMapForPerformance[name]) {
            campaignsMapForPerformance[name] = { name, spend: 0, leads: 0, leadsMeta: 0, impressions: 0, clicks: 0, qualified: 0, sales: 0 };
          }
          
          campaignsMapForPerformance[name].leads += 1;
          const status = (lead.situacao_atendimento || '').toLowerCase();
          
          // Contabilização de leads qualificados e vendas conforme status do CRM
          if (['schedule', 'visita', 'proposta', 'purchase', 'venda', 'submitapplication'].some(s => status.includes(s))) {
            campaignsMapForPerformance[name].qualified += 1;
          }
          if (status.includes('venda') || status.includes('purchase')) {
            campaignsMapForPerformance[name].sales += 1;
          }
        });

        // Passo C: Transforma o Objeto em Array e calcula métricas finais
        let campaignPerformance = Object.values(campaignsMapForPerformance).map((m: any) => ({
          ...m,
          cplReal: m.leads > 0 ? Math.round((m.spend / m.leads) * 100) / 100 : 0,
          cplMeta: m.leadsMeta > 0 ? Math.round((m.spend / m.leadsMeta) * 100) / 100 : 0,
          cpc: m.clicks > 0 ? m.spend / m.clicks : 0,
          ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
          cpm: m.impressions > 0 ? (m.spend / m.impressions) * 1000 : 0,
          // Cálculo de qualidade para o badge "REVISAR/ESTÁVEL/OTIMIZADO"
          status: m.leads > 0 && (m.qualified / m.leads) > 0.25 ? 'OTIMIZADO' : 
                  m.leads > 0 && (m.qualified / m.leads) > 0.15 ? 'ESTÁVEL' : 'REVISAR'
        })).sort((a, b) => b.spend - a.spend); // Ordena pelas campanhas que mais gastaram
        
        if (selectedCampaignFilter && selectedCampaignFilter !== "all") {
          campaignPerformance = campaignPerformance.filter(campaign => normalize(campaign.name) === normalize(selectedCampaignFilter));
        }
        
        // --- 4. KPIs SUPERIORES (Sincronizados) ---
        const filteredMetrics = (creativeMetrics || []).filter(m => {
          const campaignName = m.campaign_name || 'Sem Nome';
          return !selectedCampaignFilter || selectedCampaignFilter === 'all' || normalize(campaignName) === normalize(selectedCampaignFilter);
        });
        
        console.log(`[KPIs] Filtro aplicado: ${selectedCampaignFilter || 'all'}, Métricas filtradas: ${filteredMetrics.length}`);
        
        const totalMetrics = filteredMetrics.reduce((acc, m) => {
          acc.spend += parseMetric(m.spend);
          acc.impressions += parseMetric(m.impressions);
          acc.clicks += parseMetric(m.clicks);
          acc.leadsMeta += parseMetric(m.leads);
          acc.reach += parseMetric(m.reach);
          acc.freqSum += parseMetric(m.frequency) * parseMetric(m.impressions);
          return acc;
        }, { spend: 0, impressions: 0, clicks: 0, leadsMeta: 0, reach: 0, freqSum: 0 });

        console.log('[KPIs] Totais calculados:', totalMetrics);

        const investment = totalMetrics.spend;
        const totalLeadsMeta = totalMetrics.leadsMeta;
        const avgFrequency = totalMetrics.impressions > 0 ? totalMetrics.freqSum / totalMetrics.impressions : 0;

        // Métrica Real vinda do CRM
        const filteredCrmLeads = crmLeads?.filter(lead =>
          !selectedCampaignFilter || selectedCampaignFilter === "all" || normalize(lead.campanha_nome) === normalize(selectedCampaignFilter)
        ) || [];

        const totalLeadsCRM = filteredCrmLeads.length || 0;
        const totalSalesCRM = filteredCrmLeads.filter(l => l.situacao_atendimento?.toLowerCase().includes('venda')).length || 0;

        const totalVisitsCRM = filteredCrmLeads.filter(l =>
          ['schedule', 'visita'].some(s => l.situacao_atendimento?.toLowerCase().includes(s))
        ).length || 0;

        // Cálculos de CPL (já filtrados)
        // Use leadsMeta para o CPL das campanhas (Meta)
        const cplMeta = totalMetrics.leadsMeta > 0 ? Math.round((investment / totalMetrics.leadsMeta) * 100) / 100 : 0;
        // Use leadsCRM para o CPL Real (Financeiro)
        const cplReal = totalLeadsCRM > 0 ? Math.round((investment / totalLeadsCRM) * 100) / 100 : 0;

        // --- 5. FUNIL WATERFALL (Sincronizado com CRM) ---
        const waterfallData = [ // This should use the filtered CRM leads
          { name: 'LEADS META', value: totalLeadsMeta, percentage: 100, color: 'bg-blue-600' },
          { name: 'LEADS CRM', value: totalLeadsCRM, percentage: totalLeadsMeta > 0 ? (totalLeadsCRM / totalLeadsMeta) * 100 : 0, color: 'bg-[#f90f54]' },
          { name: 'VISITAS', value: totalVisitsCRM, percentage: totalLeadsCRM > 0 ? (totalVisitsCRM / totalLeadsCRM) * 100 : 0, color: 'bg-blue-400' },
          { name: 'VENDAS', value: totalSalesCRM, percentage: totalLeadsCRM > 0 ? (totalSalesCRM / totalLeadsCRM) * 100 : 0, color: 'bg-green-500' }
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
        console.error("Erro ao carregar dados do Dashboard:", error);
        setData(prev => ({ ...prev, isLoading: false, error: "Erro ao processar dados do dashboard." }));
      }
    }, [userId, dateRange, fetchAPISettings, fetchCRMData, fetchMetaData, fetchLocalMetricsData, toast, internalToast.toast, selectedCampaignFilter]);

  useEffect(() => {
    loadDashboardData(); // This will now be called when selectedCampaignFilter changes
  }, [loadDashboardData]); // loadDashboardData is memoized and its dependency array includes selectedCampaignFilter

  return {
    ...data,
    refetch: loadDashboardData,
  };
};
