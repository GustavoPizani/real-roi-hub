import { useState, useEffect, useCallback } from "react";
import { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { format, isSameDay } from "date-fns";
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

export const useDashboardData = (userId: string, dateRange?: DateRange) => {
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

  const fetchMetaData = useCallback(async (accessToken: string, adAccountIds: string[]) => {
    const since = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
    const until = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;
    const results = await Promise.all(
      adAccountIds.map(async (id) => {
        try {
          const { data, error } = await supabase.functions.invoke("meta-insights", {
            body: { accessToken, adAccountId: id.trim(), since, until },
          });
          if (error) throw error;
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
  }, [dateRange]);

  useEffect(() => {
    const loadDashboardData = async () => {
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

        let metaInfo = { ads: [], totalSpent: 0, channels: [] };
        if (accessToken && adAccountIds.length > 0) {
          metaInfo = await fetchMetaData(accessToken, adAccountIds) || metaInfo;
        }

        // --- 1. FONTE DA VERDADE: CRM ---
        const totalLeadsCRM = crmLeads?.length || 0;
        const totalVisitsCRM = crmLeads?.filter(l => 
          l.situacao_atendimento?.toLowerCase().includes('schedule') || 
          l.situacao_atendimento?.toLowerCase().includes('visita')
        ).length || 0;
        const totalSalesCRM = crmLeads?.filter(l => 
          l.situacao_atendimento?.toLowerCase().includes('purchase') || 
          l.situacao_atendimento?.toLowerCase().includes('venda')
        ).length || 0;

        // NOVO: Leads da Meta API
        const totalLeadsMeta = metaInfo.ads.reduce((sum, ad) => sum + (parseInt(ad.conversions || '0', 10)), 0);

        // --- 2. FUNIL WATERFALL (Sincronizado com CRM) ---
        const waterfallData: WaterfallData[] = [
          { 
            name: 'LEADS META (API)', 
            value: totalLeadsMeta, 
            percentage: 100, 
            color: 'bg-blue-600' 
          },
          { 
            name: 'LEADS CRM (REAL)', 
            value: totalLeadsCRM,
            percentage: totalLeadsMeta > 0 ? (totalLeadsCRM / totalLeadsMeta) * 100 : 0,
            color: 'bg-gradient-to-r from-[#f90f54] to-[#8735d2]' 
          },
          { 
            name: 'VISITAS AGENDADAS', 
            value: totalVisitsCRM,
            percentage: totalLeadsCRM > 0 ? (totalVisitsCRM / totalLeadsCRM) * 100 : 0,
            color: 'bg-[#0088FE]'
          },
          { 
            name: 'VENDAS', 
            value: totalSalesCRM,
            percentage: totalLeadsCRM > 0 ? (totalSalesCRM / totalLeadsCRM) * 100 : 0,
            color: 'bg-[#00C49F]'
          }
        ];

        // --- 3. PERFORMANCE POR PROJETO (UNIFICAÇÃO TOTAL) ---
        const campaignsMap: Record<string, any> = {};

        // Função auxiliar para normalizar nomes e evitar duplicidade por erro de digitação
        const normalize = (name: string) => (name || "Sem Campanha").toUpperCase().trim().replace(/\s+/g, ' ');

        // Passo A: Mapeia dados de Investimento da Meta
        metaInfo.ads.forEach(ad => {
          const name = normalize(ad.campaignName);
          if (!campaignsMap[name]) {
            campaignsMap[name] = { name, spent: 0, leads: 0, leadsMeta: 0, qualified: 0, sales: 0 };
          }
          campaignsMap[name].spent += ad.spend;
          campaignsMap[name].leadsMeta += parseInt(ad.conversions || '0', 10);
        });

        // Passo B: Agrega dados do CRM (Mesmo que a campanha não tenha gasto na Meta no período)
        crmLeads?.forEach((lead: any) => {
          const name = normalize(lead.campanha_nome);
          
          if (!campaignsMap[name]) {
            // Cria a entrada caso o lead pertença a uma campanha que não teve gasto (investimento) no período selecionado
            campaignsMap[name] = { name, spent: 0, leads: 0, leadsMeta: 0, qualified: 0, sales: 0 };
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
          cplReal: m.leads > 0 ? m.spent / m.leads : 0,
          cplMeta: m.leadsMeta > 0 ? m.spent / m.leadsMeta : 0,
          // Cálculo de qualidade para o badge "REVISAR/ESTÁVEL/OTIMIZADO"
          status: m.leads > 0 && (m.qualified / m.leads) > 0.25 ? 'OTIMIZADO' : 
                  m.leads > 0 && (m.qualified / m.leads) > 0.15 ? 'ESTÁVEL' : 'REVISAR'
        })).sort((a, b) => b.spent - a.spent); // Ordena pelas campanhas que mais gastaram

        // --- 4. KPIs SUPERIORES (Sincronizados) ---
        const investment = metaInfo.totalSpent;
        const cplReal = totalLeadsCRM > 0 ? investment / totalLeadsCRM : 0;
        const cplMeta = totalLeadsMeta > 0 ? investment / totalLeadsMeta : 0;

        setData({
          temporalData: [], // Pode ser populado conforme necessidade
          channelsData: metaInfo.channels,
          waterfallData,
          campaignPerformance,
          adsData: metaInfo.ads,
          kpis: {
            investido: investment,
            totalLeadsCRM,
            totalLeadsMeta,
            cplReal,
            cplMeta,
            roiReal: investment > 0 ? (totalSalesCRM * 5000 / investment) : 0 // Exemplo de cálculo de ROI
          },
          isUsingMockData: !accessToken,
          isLoading: false,
          error: null,
        });

      } catch (error) {
        console.error("Erro Dashboard Data:", error);
        setData(prev => ({ ...prev, isLoading: false, error: "Erro ao processar dados." }));
      }
    };

    loadDashboardData();
  }, [userId, dateRange, fetchAPISettings, fetchCRMData, fetchMetaData]);

  return data;
};
