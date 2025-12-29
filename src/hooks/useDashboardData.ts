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

  interface KPIs {
    investido: number;
    resultado: number;
    custoPorResultado: number;
    roiReal: number;
  }

  interface DashboardData {
    temporalData: TemporalDataPoint[];
    channelsData: { name: string; value: number }[];
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
      const sales = leads?.filter((lead) =>
        lead.situacao_atendimento?.toLowerCase().includes("venda")
      ).length || 0;

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
            formattedDate = format(leadDate, 'HH:00'); // Group by hour for single day view
          } else {
            // Handles ISO string (YYYY-MM-DDTHH:mm:ss.sssZ) by taking only the date part
            const dateStr = lead.cadastro.split('T')[0];
            const [_, month, day] = dateStr.split('-');
            formattedDate = `${day}/${month}`;
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
          if (!accessToken || adAccountIds.length === 0) {
            setData((prev) => ({
              ...prev,
              isUsingMockData: true,
              isLoading: false,
              error: "Configure suas APIs Meta para ver métricas de investimento, CPR e ROI.",
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

          const metaData = await fetchMetaData(accessToken, adAccountIds);

          if (!metaData) {
            let errorMessage = "Erro ao buscar dados da Meta. Verifique suas credenciais.";
            if (metaData && metaData.error) {
              errorMessage += ` Detalhes: ${metaData.error}`;
            }
            throw new Error(errorMessage);


          }

          // Calculate realLeads per ad by cross-referencing with CRM data from the period
          const leadsByAdMap = new Map<string, number>();
          crmData.allLeads?.forEach(lead => {
            if (lead.fac_id) {
              leadsByAdMap.set(lead.fac_id, (leadsByAdMap.get(lead.fac_id) || 0) + 1);
            }
          });
          
          const adsWithRealLeads = metaData.adsData.map((ad: AdData) => ({
            ...ad,
            realLeads: leadsByAdMap.get(ad.id) || 0,
          }));

          // Group ads by campaign
          const campaigns: Record<string, CampaignData> = {};
          adsWithRealLeads.forEach((ad: AdData) => {
            const campaignName = ad.campaignName || 'Sem Campanha';
            if (!campaigns[campaignName]) {
              campaigns[campaignName] = { campaignName, ads: [], totalSpend: 0, totalLeads: 0 };
            }
            campaigns[campaignName].ads.push(ad);
            campaigns[campaignName].totalSpend += ad.spend;
            campaigns[campaignName].totalLeads += ad.realLeads || 0;
          });

          const investment = metaData.kpis.investido;
          const totalLeadsFromCRM = crmData.totalLeads;
          
          const custoPorResultado = totalLeadsFromCRM > 0 ? investment / totalLeadsFromCRM : 0;

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

          // Merge temporal data from Meta (investment) and CRM (leads)
          const temporalMap = new Map<string, { investimento: number; leads: number }>();
          metaData.temporalData.forEach(item => {
            temporalMap.set(item.date, { investimento: item.investimento, leads: 0 });
          });
          crmData.leadsByDate.forEach(item => {
            const existing = temporalMap.get(item.date) || { investimento: 0, leads: 0 };
            temporalMap.set(item.date, { investimento: existing.investimento, leads: (existing.leads || 0) + item.leads });
          });
          const finalTemporalData = Array.from(temporalMap.entries()).map(([date, values]) => ({ date, ...values })).sort((a, b) => a.date.localeCompare(b.date));

          setData({
            temporalData: finalTemporalData,
            channelsData: metaData.channelsData || [],
            campaignData: Object.values(campaigns),
            adsData: adsWithRealLeads,
            kpis: {
              investido: investment,
              resultado: totalLeadsFromCRM,
              custoPorResultado: custoPorResultado,
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
