import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import CryptoJS from "crypto-js";

const ENCRYPTION_KEY = "ads-intel-hub-2024";

interface TemporalDataPoint {
  date: string;
  investimento: number;
  leads: number;
}

interface DeviceDataPoint {
  name: string;
  value: number;
}

interface PeriodDataPoint {
  period: string;
  value: number;
}

interface AdData {
  id: string;
  name: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  costPerResult: number;
  thumbnail_url?: string;
}

interface KPIs {
  investido: number;
  resultado: number;
  custoPorResultado: number;
  roiReal: number;
}

interface DashboardData {
  temporalData: TemporalDataPoint[];
  devicesData: DeviceDataPoint[];
  periodData: PeriodDataPoint[];
  adsData: AdData[];
  kpis: KPIs;
  isUsingMockData: boolean;
  isLoading: boolean;
  error: string | null;
}

const decrypt = (ciphertext: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return "";
  }
};

export const useDashboardData = (userId: string) => {
  const [data, setData] = useState<DashboardData>({
    temporalData: [],
    devicesData: [],
    periodData: [],
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

  const fetchCRMData = useCallback(async () => {
    if (!userId) return { totalSales: 0, totalRevenue: 0 };

    const { data: leads, error } = await supabase
      .from("crm_leads")
      .select("situacao_atendimento")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching CRM data:", error);
      return { totalSales: 0, totalRevenue: 0 };
    }

    // Count "Venda" status as sales
    const sales = leads?.filter((lead) => 
      lead.situacao_atendimento?.toLowerCase().includes("venda")
    ).length || 0;

    // Estimate average ticket (can be configured later)
    const avgTicket = 350000; // R$ 350k average real estate sale
    const revenue = sales * avgTicket;

    return { totalSales: sales, totalRevenue: revenue };
  }, [userId]);

  const fetchMetaData = useCallback(async (accessToken: string, adAccountIds: string[]) => {
    try {
      // Fetch data from all accounts in parallel
      const promises = adAccountIds.map((adAccountId) =>
        supabase.functions.invoke("meta-insights", {
          body: { accessToken, adAccountId: adAccountId.trim() },
        })
      );

      const results = await Promise.all(promises);
      
      // Aggregate data from all accounts
      const aggregated = {
        kpis: { investido: 0, resultado: 0, custoPorResultado: 0, roiReal: 0 },
        temporalData: [] as TemporalDataPoint[],
        devicesData: [] as DeviceDataPoint[],
        periodData: [] as PeriodDataPoint[],
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

        // Aggregate devices data
        data.devicesData?.forEach((item: DeviceDataPoint) => {
          const existing = devicesMap.get(item.name) || 0;
          devicesMap.set(item.name, existing + item.value);
        });

        // Aggregate period data
        data.periodData?.forEach((item: PeriodDataPoint) => {
          const existing = periodMap.get(item.period) || 0;
          periodMap.set(item.period, existing + item.value);
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

      aggregated.devicesData = Array.from(devicesMap.entries())
        .map(([name, value]) => ({ name, value }));

      aggregated.periodData = Array.from(periodMap.entries())
        .map(([period, value]) => ({ period, value }));

      return aggregated;
    } catch (error) {
      console.error("Error calling meta-insights:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!userId) {
        setData((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      setData((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Fetch API settings
        const settings = await fetchAPISettings();
        
        const accessToken = settings?.META_ACCESS_TOKEN;
        const adAccountIds = settings?.META_AD_ACCOUNT_IDS?.split(",").filter(Boolean) || [];

        if (!accessToken || adAccountIds.length === 0) {
          setData((prev) => ({
            ...prev,
            isUsingMockData: true,
            isLoading: false,
            error: "Configure suas APIs Meta nas configurações para ver dados reais.",
          }));
          return;
        }

        // Fetch real Meta data from all accounts
        const metaData = await fetchMetaData(accessToken, adAccountIds);

        if (!metaData) {
          setData((prev) => ({
            ...prev,
            isUsingMockData: true,
            isLoading: false,
            error: "Erro ao buscar dados da Meta. Verifique suas credenciais.",
          }));
          return;
        }

        // Fetch CRM data for ROI calculation
        const crmData = await fetchCRMData();

        // Calculate ROI Real
        const investment = metaData.kpis.investido;
        const roiReal = investment > 0 
          ? ((crmData.totalRevenue - investment) / investment) * 100 
          : 0;

        setData({
          temporalData: metaData.temporalData || [],
          devicesData: metaData.devicesData || [],
          periodData: metaData.periodData || [],
          adsData: metaData.adsData || [],
          kpis: {
            investido: metaData.kpis.investido,
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
          error: "Erro ao carregar dados. Tente novamente.",
        }));
      }
    };

    loadDashboardData();
  }, [userId, fetchAPISettings, fetchMetaData, fetchCRMData]);

  return data;
};
