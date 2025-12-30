  import { useState, useEffect, useCallback } from "react";
  import { DateRange } from "react-day-picker";
  import { supabase } from "@/integrations/supabase/client";
  import { format, isSameDay } from "date-fns";
  import CryptoJS from "crypto-js";

  const ENCRYPTION_KEY = "ads-intel-hub-2024";

  interface TemporalDataPoint {
    date: string;
    investimento: number;
    leads: number;
  }

  interface AdData {
    id: string;
    name: string;
    campaignId?: string;
    campaignName?: string;
    impressions: number;
    clicks: number;
    spend: number;
    conversions: number;
    costPerResult: number;
    realLeads?: number;
    thumbnail_url?: string;
  }

  interface CampaignData {
    campaignName: string;
    ads: AdData[];
    totalSpend: number;
    totalLeads: number;
  }

  interface LeadCostInsight {
    cost: number;
    timestamp: string;
  }

  interface KPIs {
    investido: number;
    resultado: number;
    custoPorResultado: number;
    roiReal: number;
  }

  interface DashboardData {
    temporalData: TemporalDataPoint[];
    channelsData: { name: string; value: number }[];
    leadCostInsights?: {
      cheapest: LeadCostInsight | null;
      mostExpensive: LeadCostInsight | null;
    };
    campaignData: CampaignData[];
    adsData: AdData[];
    kpis: KPIs;
    isUsingMockData: boolean;
    isLoading: boolean;
    error: string | null;
  }

  interface CrmData {
    totalSales: number;
    totalRevenue: number;
    totalLeads: number;
    leadsByDate: { date: string; leads: number }[];
    allLeads: { fac_id: string | null; cadastro: string }[];
  }

  const decrypt = (ciphertext: string): string => {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
      return "";
    }
  };

  export const useDashboardData = (userId: string, dateRange?: DateRange) => {
    const [data, setData] = useState<DashboardData>({
      temporalData: [],
      channelsData: [],
      leadCostInsights: { cheapest: null, mostExpensive: null },
      campaignData: [],
      adsData: [],
      kpis: { investido: 0, resultado: 0, custoPorResultado: 0, roiReal: 0 },
      isUsingMockData: true,
      isLoading: true,
      error: null,
    });

    const fetchAPISettings = useCallback(async () => {
      if (!userId) return null;

      const { data: settings, error } = await supabase
        .from("api_settings")
        .select("setting_key, encrypted_value")
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching API settings:", error);
        return null;
      }

      const decrypted: Record<string, string> = {};
      settings?.forEach((item) => {
        decrypted[item.setting_key] = decrypt(item.encrypted_value);
      });

      return decrypted;
    }, [userId]);

    const fetchCRMData = useCallback(async (): Promise<CrmData> => {
      if (!userId) return { totalSales: 0, totalRevenue: 0, totalLeads: 0, leadsByDate: [], allLeads: [] };

      let query = supabase
        .from("crm_leads")
        .select("situacao_atendimento, cadastro, fac_id")
        .eq("user_id", userId);

      if (dateRange?.from) {
        query = query.gte("cadastro", dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        query = query.lte("cadastro", dateRange.to.toISOString());
      }

      const { data: leads, error } = await query;

      if (error) {
        console.error("Error fetching CRM data:", error);
        return { totalSales: 0, totalRevenue: 0, totalLeads: 0, leadsByDate: [], allLeads: [] };
      }

      const totalLeads = leads?.length || 0;

      // Count "Venda" status as sales
      const sales = leads?.filter((lead) => {
        const status = lead.situacao_atendimento?.toLowerCase() || '';
        return status.includes("venda") || status.includes("purchase");
      }).length || 0;

      // Estimate average ticket (can be configured later)
      const avgTicket = 350000; // R$ 350k average real estate sale
      const revenue = sales * avgTicket;

      // Group leads by date for temporal chart
      const leadsByDateMap = new Map<string, number>();
      const isSingleDay = dateRange?.from && dateRange.to && isSameDay(dateRange.from, dateRange.to);

      leads?.forEach(lead => {
        if (lead.cadastro) {
          const leadDate = new Date(lead.cadastro);
          let formattedDate: string;

          if (isSingleDay) {
            // Para visão de HOJE: Garante o formato HH:00
            formattedDate = `${leadDate.getHours().toString().padStart(2, '0')}:00`;
          } else {
            const datePart = lead.cadastro.split('T')[0];
            const [y, m, d] = datePart.split('-');
            formattedDate = `${d}/${m}`;
          }
          leadsByDateMap.set(formattedDate, (leadsByDateMap.get(formattedDate) || 0) + 1);
        }
      });

      const leadsByDate = Array.from(leadsByDateMap.entries()).map(([date, count]) => ({ date, leads: count }));

      return { totalSales: sales, totalRevenue: revenue, totalLeads, allLeads: leads || [], leadsByDate: leadsByDate.sort((a, b) => a.date.localeCompare(b.date)) };
    }, [userId, dateRange]);

    const fetchMetaData = useCallback(async (accessToken: string, adAccountIds: string[]) => {
      try {
        // Adicione esta validação antes do Promise.all
        if (!accessToken || adAccountIds.length === 0) {
          console.error("Credenciais ausentes para a Meta");
          return null;
        }

        const since = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
        const until = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;

        // Fetch data from all accounts in parallel
        const promises = adAccountIds.map((adAccountId) =>
          supabase.functions.invoke("meta-insights", {
            body: { accessToken, adAccountId: adAccountId.trim(), since, until },
          })
        );

        const results = await Promise.all(promises);
        
        // Aggregate data from all accounts
        const aggregated = {
          kpis: { investido: 0, resultado: 0, custoPorResultado: 0, roiReal: 0 },
          temporalData: [] as TemporalDataPoint[],
          channelsData: [] as { name: string; value: number }[],
          adsData: [] as AdData[],
        };

        const temporalMap = new Map<string, { investimento: number; leads: number }>();
        const devicesMap = new Map<string, number>();
        const periodMap = new Map<string, number>();

        let successCount = 0;

        for (const response of results) {
          if (response.error || !response.data) {
            console.error("Meta insights error:", response.error);
            continue;
          }

          successCount++;
          const data = response.data;

          // Aggregate KPIs
          aggregated.kpis.investido += data.kpis?.investido || 0;
          aggregated.kpis.resultado += data.kpis?.resultado || 0;

          // Aggregate temporal data
          data.temporalData?.forEach((item: TemporalDataPoint) => {
            const existing = temporalMap.get(item.date) || { investimento: 0, leads: 0 };
            temporalMap.set(item.date, {
              investimento: existing.investimento + item.investimento,
              leads: existing.leads + item.leads,
            });
          });

          // Aggregate channels data
          data.channelsData?.forEach((item: { name: string; value: number }) => {
            const existing = devicesMap.get(item.name) || 0;
            devicesMap.set(item.name, existing + item.value);
          });

          // Combine all ads
          if (data.adsData) {
            aggregated.adsData.push(...data.adsData);
          }
        }

        if (successCount === 0) {
          return null;
        }

        // Calculate cost per result
        aggregated.kpis.custoPorResultado = aggregated.kpis.resultado > 0
          ? aggregated.kpis.investido / aggregated.kpis.resultado
          : 0;

        // Convert maps to arrays
        aggregated.temporalData = Array.from(temporalMap.entries())
          .map(([date, values]) => ({ date, ...values }))
          .sort((a, b) => a.date.localeCompare(b.date));

        aggregated.channelsData = Array.from(devicesMap.entries())
          .map(([name, value]) => ({ name, value }));

        return aggregated;
      } catch (error) {
        console.error("Error calling meta-insights:", error);
        return null;
      }
    }, [dateRange]);

    // ADICIONE ESTE BLOCO PARA O SCAN DE DIAGNÓSTICO
    const settingsDiagnostic = async () => {
      console.log("=== SCAN DE DIAGNÓSTICO DE APIS ===");
      const { data: rawData, error } = await supabase.from("api_settings").select("*");
      
      if (error) {
        console.error("DEBUG: Erro ao acessar a tabela api_settings:", error.message);
        return;
      }

      console.log(`DEBUG: Total de chaves encontradas no banco: ${rawData?.length}`);
      
      rawData?.forEach(item => {
        try {
          const decrypted = decrypt(item.encrypted_value);
          console.log(`DEBUG: Chave [${item.setting_key}] encontrada. Status: ${decrypted ? "Descriptografada com Sucesso" : "FALHA NA DESCRIPTOGRAFIA"}`);
        } catch (e) {
          console.error(`DEBUG: Erro crítico ao tentar ler a chave ${item.setting_key}`);
        }
      });
    };

    // Chame a função dentro do useEffect para rodar o scan assim que o dashboard carregar
    useEffect(() => { settingsDiagnostic(); }, [userId]);

    useEffect(() => {
      const loadDashboardData = async () => {
        if (!userId) {
          setData((prev) => ({ ...prev, isLoading: false }));
          return;
        }

        setData((prev) => ({ ...prev, isLoading: true, error: null, isUsingMockData: false }));

        try {
          // Fetch both CRM and API data in parallel
          const [crmData, settings] = await Promise.all([
            fetchCRMData(),
            fetchAPISettings()
          ]);
          
          const accessToken = settings?.META_ACCESS_TOKEN;
          const adAccountIds = settings?.META_AD_ACCOUNT_IDS?.split(",").filter(Boolean) || [];

          // If Meta API is not configured or failed, we can still show CRM data
          // VALIDAÇÃO CRUCIAL: Se não houver token, não dispara a Edge Function (evita erro 400)
          if (!accessToken || adAccountIds.length === 0) {
            console.warn("Credenciais Meta não encontradas. Exibindo apenas dados do CRM.");
            setData((prev) => ({
              ...prev,
              isUsingMockData: true,
              isLoading: false,
              error: "Configure suas APIs Meta para ver métricas de investimento.",
              kpis: {
                investido: 0,
                resultado: crmData.totalLeads, // Show real leads from CRM
                custoPorResultado: 0,
                roiReal: 0,
              },
              temporalData: crmData.leadsByDate.map(item => ({ date: item.date, investimento: 0, leads: item.leads })).sort((a, b) => a.date.localeCompare(b.date)),
              channelsData: [],
              campaignData: [],
              adsData: [],
            }));
            return;
          }

          // Dentro de loadDashboardData, envolva a chamada fetchMetaData em um try/catch específico
          let metaData = null;
          try {
              metaData = await fetchMetaData(accessToken, adAccountIds);
          } catch (metaErr) {
              console.error("Falha específica na Meta API, prosseguindo apenas com CRM:", metaErr);
          }

          // Se metaData for null, o sistema deve continuar usando crmData para não ficar zerado
          if (!metaData) {
            const totalLeadsFromCRM = crmData.totalLeads;
            setData({
              temporalData: crmData.leadsByDate.map(item => ({ date: item.date, investimento: 0, leads: item.leads })),
              channelsData: [],
              campaignData: [],
              adsData: [],
              kpis: {
                investido: 0,
                resultado: totalLeadsFromCRM,
                custoPorResultado: 0,
                roiReal: 0,
              },
              isUsingMockData: true, // Indicates that we are not showing full data
              isLoading: false,
              error: "Falha ao buscar dados da Meta. Exibindo apenas dados do CRM.",
            });
            return;
          }

          // Group ads by campaign
          // Localize o agrupamento dentro de loadDashboardData
          const campaigns: Record<string, CampaignData> = {};

          // Use metaData.adsData DIRETAMENTE para garantir que vem da Meta
          metaData.adsData.forEach((ad: AdData) => {
            const campaignName = ad.campaignName || 'Sem Campanha';
            
            if (!campaigns[campaignName]) {
              campaigns[campaignName] = { 
                campaignName, 
                ads: [], 
                totalSpend: 0, 
                totalLeads: 0 
              };
            }

            // Criamos o objeto do anúncio usando 'conversions' da Meta para 'realLeads' e 'totalLeads'
            const adWithMetaLeads = {
              ...ad,
              realLeads: ad.conversions || 0,
              conversions: ad.conversions || 0
            };

            campaigns[campaignName].ads.push(adWithMetaLeads);
            campaigns[campaignName].totalSpend += ad.spend;
            campaigns[campaignName].totalLeads += ad.conversions || 0; // Soma leads da Meta
          });

          const investment = metaData.kpis.investido;

          const roiReal = investment > 0 
            ? ((crmData.totalRevenue - investment) / investment) * 100 
            : 0;

          // Lógica de Custo Incremental (Solicitada por você)
          const processedLeads = crmData.allLeads
            .filter(lead => lead.cadastro)
            .sort((a, b) => new Date(a.cadastro).getTime() - new Date(b.cadastro).getTime())
            .map((lead, index, array) => {
              const leadTime = new Date(lead.cadastro);
              const dateKey = format(leadTime, "dd/MM");
              
              // Pega o gasto total do dia vindo da Meta
              const dailySpend = metaData.temporalData.find(d => d.date === dateKey)?.investimento || 0;
              
              // Distribuição linear do gasto (24h = 1440 min)
              const minutesElapsed = leadTime.getHours() * 60 + leadTime.getMinutes();
              const currentCumulativeSpend = (dailySpend / 1440) * minutesElapsed;
              
              let previousSpend = 0;
              const leadAnterior = array[index - 1];
              
              // Se o lead anterior for do mesmo dia, subtraímos o acumulado dele
              if (leadAnterior && new Date(leadAnterior.cadastro).toDateString() === leadTime.toDateString()) {
                const prevDate = new Date(leadAnterior.cadastro);
                const prevMinutes = prevDate.getHours() * 60 + prevDate.getMinutes();
                previousSpend = (dailySpend / 1440) * prevMinutes;
              }
              
              return { 
                ...lead, 
                individualCost: currentCumulativeSpend - previousSpend 
              };
            });

          // Identifica Lead Mais Caro e Mais Barato
          let mostExpensive: (typeof processedLeads)[0] | null = null;
          let cheapest: (typeof processedLeads)[0] | null = null;

          if (processedLeads.length > 0) {
            mostExpensive = processedLeads.reduce((prev, curr) => 
              (prev.individualCost > curr.individualCost) ? prev : curr
            );

            const positiveCostLeads = processedLeads.filter(l => l.individualCost > 0);
            if (positiveCostLeads.length > 0) {
              cheapest = positiveCostLeads.reduce((prev, curr) => 
                (prev.individualCost < curr.individualCost) ? prev : curr
              );
            }
          }

          // No final do loadDashboardData, ajuste o merge do temporalMap
          const temporalMap = new Map<string, { investimento: number; leads: number }>();
          // Prioridade para os dados da Meta
          metaData.temporalData.forEach(item => {
            temporalMap.set(item.date, { investimento: item.investimento, leads: item.leads });
          });
          const finalTemporalData = Array.from(temporalMap.entries()).map(([date, values]) => ({ date, ...values })).sort((a, b) => a.date.localeCompare(b.date));

          setData({
            temporalData: finalTemporalData,
            channelsData: metaData.channelsData || [],
            leadCostInsights: {
              cheapest: cheapest ? { cost: cheapest.individualCost, timestamp: cheapest.cadastro } : null,
              mostExpensive: mostExpensive ? { cost: mostExpensive.individualCost, timestamp: mostExpensive.cadastro } : null,
            },
            campaignData: Object.values(campaigns),
            adsData: Object.values(campaigns).flatMap(c => c.ads),
            kpis: {
              investido: investment,
              resultado: metaData.kpis.resultado,
              custoPorResultado: metaData.kpis.custoPorResultado,
              roiReal: roiReal,
            },
            isUsingMockData: false,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          console.error("Error loading dashboard data:", error);
          setData((prev) => ({
            ...prev,
            isLoading: false,
            isUsingMockData: true,
            error: "Erro ao carregar dados. Tente novamente.",
          }));
        }
      };

      loadDashboardData();
    }, [userId, dateRange, fetchAPISettings, fetchMetaData, fetchCRMData]);

    return data;
  };
