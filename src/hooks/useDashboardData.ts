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
    kpis: { investido: 0, resultado: 0, custoPorResultado: 0, roiReal: 0 },
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
    const promises = adAccountIds.map((id) =>
      supabase.functions.invoke("meta-insights", { body: { accessToken, adAccountId: id.trim(), since, until } })
    );
    const results = await Promise.all(promises);
    
    const ads: any[] = [];
    let totalSpent = 0;
    const channels: any[] = [];

    results.forEach(res => {
      if (res.data) {
        ads.push(...(res.data.adsData || []));
        totalSpent += res.data.kpis?.investido || 0;
        if (res.data.channelsData) channels.push(...res.data.channelsData);
      }
    });
    return { ads, totalSpent, channels };
  }, [dateRange]);

  useEffect(() => {
    const loadDashboardData = async () => {
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

        const adAccountIds = adAccountIdsRaw?.split(",").filter(Boolean) || [];

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

        // --- 2. FUNIL WATERFALL (Sincronizado com CRM) ---
        const waterfallData: WaterfallData[] = [
          { name: 'LEADS GERADOS (CRM)', value: totalLeadsCRM, percentage: 100, color: 'bg-gradient-to-r from-[#f90f54] to-[#8735d2]' },
          { 
            name: 'VISITAS AGENDADAS', 
            value: totalVisitsCRM,
            percentage: totalLeadsCRM > 0 ? (totalVisitsCRM / totalLeadsCRM) * 100 : 0,
            color: 'bg-[#0088FE]'
          },
          { 
            name: 'VENDAS CONCRETIZADAS', 
            value: totalSalesCRM,
            percentage: totalLeadsCRM > 0 ? (totalSalesCRM / totalLeadsCRM) * 100 : 0,
            color: 'bg-[#00C49F]'
          }
        ];

        // --- 3. PERFORMANCE POR PROJETO (UNIFICAÇÃO) ---
        const campaignsMap: Record<string, any> = {};

        // Inicia com dados da Meta (Investimento)
        metaInfo.ads.forEach(ad => {
          const name = (ad.campaignName || "Sem Campanha").toUpperCase().trim();
          if (!campaignsMap[name]) {
            campaignsMap[name] = { name, spent: 0, leads: 0, qualified: 0, sales: 0 };
          }
          campaignsMap[name].spent += ad.spend;
        });

        // Soma dados do CRM por Campanha
        crmLeads?.forEach((lead: any) => {
          const name = (lead.campanha_nome || "Sem Campanha").toUpperCase().trim();
          
          if (!campaignsMap[name]) {
            campaignsMap[name] = { name, spent: 0, leads: 0, qualified: 0, sales: 0 };
          }
          
          campaignsMap[name].leads += 1;
          const status = lead.situacao_atendimento?.toLowerCase() || '';
          
          if (['schedule', 'visita', 'proposta', 'purchase', 'venda'].some(s => status.includes(s))) {
            campaignsMap[name].qualified += 1;
          }
          if (status.includes('venda') || status.includes('purchase')) {
            campaignsMap[name].sales += 1;
          }
        });

        const campaignPerformance = Object.values(campaignsMap).map((m: any) => ({
          ...m,
          cplReal: m.leads > 0 ? m.spent / m.leads : 0,
          status: (m.qualified / m.leads) > 0.25 ? 'OTIMIZADO' : (m.qualified / m.leads) > 0.15 ? 'ESTÁVEL' : 'REVISAR'
        }));

        // --- 4. KPIs SUPERIORES (Sincronizados) ---
        const investment = metaInfo.totalSpent;
        const cplGlobal = totalLeadsCRM > 0 ? investment / totalLeadsCRM : 0;

        setData({
          temporalData: [], // Pode ser populado conforme necessidade
          channelsData: metaInfo.channels,
          waterfallData,
          campaignPerformance,
          adsData: metaInfo.ads,
          kpis: {
            investido: investment,
            resultado: totalLeadsCRM, // Leads Reais do CRM
            custoPorResultado: cplGlobal,
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

    if (userId) {
      loadDashboardData();
    } else {
      // Se não houver usuário, define um estado limpo e sem carregamento
      setData({
        isUsingMockData: true,
        isLoading: false,
        error: "Aguardando autenticação do usuário.",
        kpis: { investido: 0, resultado: 0, custoPorResultado: 0, roiReal: 0 },
        campaignPerformance: [],
        waterfallData: [],
        channelsData: [],
        adsData: [],
      });
    }
  }, [userId, dateRange, fetchAPISettings, fetchCRMData, fetchMetaData]);

  return data;
};
