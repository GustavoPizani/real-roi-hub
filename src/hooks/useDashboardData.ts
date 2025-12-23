import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Mock data for demonstration
const MOCK_TEMPORAL_DATA = [
  { date: "01/12", investimento: 1500, leads: 45 },
  { date: "08/12", investimento: 2200, leads: 62 },
  { date: "15/12", investimento: 1800, leads: 51 },
  { date: "22/12", investimento: 3100, leads: 89 },
];

const MOCK_DEVICES_DATA = [
  { name: "Mobile", value: 65 },
  { name: "Desktop", value: 28 },
  { name: "Tablet", value: 7 },
];

const MOCK_PERIOD_DATA = [
  { period: "Manhã", value: 35 },
  { period: "Tarde", value: 52 },
  { period: "Noite", value: 28 },
  { period: "Madrugada", value: 12 },
];

const MOCK_ADS = [
  { id: "1", name: "Lançamento Edifício Aurora", impressions: 45230, clicks: 1289, spend: 850.00, conversions: 23, costPerResult: 36.96 },
  { id: "2", name: "Promoção Black Week", impressions: 38540, clicks: 987, spend: 720.50, conversions: 18, costPerResult: 40.03 },
  { id: "3", name: "Apartamentos 2Q Centro", impressions: 29870, clicks: 756, spend: 580.00, conversions: 15, costPerResult: 38.67 },
  { id: "4", name: "Casas em Condomínio", impressions: 22340, clicks: 543, spend: 420.00, conversions: 11, costPerResult: 38.18 },
];

const MOCK_KPIS = {
  investido: 8570.50,
  resultado: 247,
  custoPorResultado: 34.70,
  roiReal: 185.3,
};

interface DashboardData {
  temporalData: typeof MOCK_TEMPORAL_DATA;
  devicesData: typeof MOCK_DEVICES_DATA;
  periodData: typeof MOCK_PERIOD_DATA;
  adsData: typeof MOCK_ADS;
  kpis: typeof MOCK_KPIS;
  isUsingMockData: boolean;
  isLoading: boolean;
}

export const useDashboardData = (userId: string) => {
  const [data, setData] = useState<DashboardData>({
    temporalData: MOCK_TEMPORAL_DATA,
    devicesData: MOCK_DEVICES_DATA,
    periodData: MOCK_PERIOD_DATA,
    adsData: MOCK_ADS,
    kpis: MOCK_KPIS,
    isUsingMockData: true,
    isLoading: true,
  });

  useEffect(() => {
    checkAPIConfiguration();
  }, [userId]);

  const checkAPIConfiguration = async () => {
    try {
      const { data: settings, error } = await supabase
        .from("api_settings")
        .select("setting_key")
        .eq("user_id", userId);

      if (error) throw error;

      const configuredKeys = settings?.map((s) => s.setting_key) || [];
      const requiredKeys = ["META_ACCESS_TOKEN", "META_APP_ID"];
      const hasAllKeys = requiredKeys.every((key) => configuredKeys.includes(key));

      if (hasAllKeys) {
        // Would fetch real data here from Meta API
        // For now, we'll use mock data
        setData((prev) => ({
          ...prev,
          isUsingMockData: false,
          isLoading: false,
        }));
      } else {
        setData((prev) => ({
          ...prev,
          isUsingMockData: true,
          isLoading: false,
        }));
      }
    } catch (error) {
      console.error("Error checking API configuration:", error);
      setData((prev) => ({
        ...prev,
        isLoading: false,
      }));
    }
  };

  return data;
};
