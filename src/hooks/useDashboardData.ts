import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";

export const useDashboardData = (dateRange?: DateRange, refreshTrigger?: number) => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [creatives, setCreatives] = useState<any[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<any[]>([]);
  const [rawMetrics, setRawMetrics] = useState<any[]>([]); // NOVO: Dados para filtro dinâmico
  const [isLoading, setIsLoading] = useState(true);
  
  const [kpis, setKpis] = useState({
    investido: 0,
    impressions: 0,
    clicks: 0,
    leads: 0,
    reach: 0,
    cpl: 0,
    ctr: 0,
    cpc: 0,
    crm_leads: 0,
    sales: 0,
    revenue: 0,
  });

  const safeNumber = (val: any) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Busca dados do Meta
      let query = supabase
        .from("campaign_metrics")
        .select("*")
        .eq("user_id", user.id);

      if (dateRange?.from) {
        query = query.gte("date", format(dateRange.from, "yyyy-MM-dd"));
      }
      if (dateRange?.to) {
        query = query.lte("date", format(dateRange.to, "yyyy-MM-dd"));
      }

      const { data: metricsData, error: metricsError } = await query;
      if (metricsError) throw metricsError;

      setRawMetrics(metricsData || []); // Guardando dados brutos

      // 2. Busca dados do CRM
      let crmQuery = supabase
        .from("crm_leads")
        .select("*")
        .eq("user_id", user.id);
        
      if (dateRange?.from) {
        crmQuery = crmQuery.gte("created_at", format(dateRange.from, "yyyy-MM-dd"));
      }
      if (dateRange?.to) {
        crmQuery = crmQuery.lte("created_at", format(dateRange.to, "yyyy-MM-dd") + " 23:59:59");
      }

      const { data: crmData, error: crmError } = await crmQuery;

      // 3. Processamento
      const campaignGroups: Record<string, any> = {};
      const creativeGroups: Record<string, any> = {};
      const dailyGroups: Record<string, any> = {};
      
      let totalSpend = 0;
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalLeads = 0;
      let totalReach = 0;

      (metricsData || []).forEach((row) => {
        const campName = row.campaign_name || "Sem Nome";
        const adName = row.ad_name || "Criativo Sem Nome";
        const dateStr = row.date;
        
        const spend = safeNumber(row.spend);
        const leads = safeNumber(row.leads);
        const impressions = safeNumber(row.impressions);
        const clicks = safeNumber(row.clicks);
        const reach = safeNumber(row.reach);

        totalSpend += spend;
        totalLeads += leads;
        totalImpressions += impressions;
        totalClicks += clicks;
        totalReach += reach;

        // A. Campanhas
        if (!campaignGroups[campName]) {
          campaignGroups[campName] = { campaign_name: campName, spend: 0, leads: 0, impressions: 0, clicks: 0, reach: 0 };
        }
        campaignGroups[campName].spend += spend;
        campaignGroups[campName].leads += leads;
        campaignGroups[campName].impressions += impressions;
        campaignGroups[campName].clicks += clicks;
        campaignGroups[campName].reach += reach;

        // B. Criativos
        const creativeKey = `${adName}_${campName}`; 
        if (!creativeGroups[creativeKey]) {
          creativeGroups[creativeKey] = { ad_name: adName, campaign_name: campName, thumbnail_url: row.thumbnail_url, channel: row.channel, spend: 0, leads: 0, impressions: 0, clicks: 0 };
        }
        creativeGroups[creativeKey].spend += spend;
        creativeGroups[creativeKey].leads += leads;
        creativeGroups[creativeKey].impressions += impressions;
        creativeGroups[creativeKey].clicks += clicks;

        // C. Diário (Global)
        if (!dailyGroups[dateStr]) {
          dailyGroups[dateStr] = { date: dateStr, spend: 0, leads: 0 };
        }
        dailyGroups[dateStr].spend += spend;
        dailyGroups[dateStr].leads += leads;
      });

      // Formatação Final
      const formattedCampaigns = Object.values(campaignGroups).map((camp: any) => ({
        ...camp,
        cpl: camp.leads > 0 ? camp.spend / camp.leads : 0,
        ctr: camp.impressions > 0 ? (camp.clicks / camp.impressions) * 100 : 0,
        cpc: camp.clicks > 0 ? camp.spend / camp.clicks : 0,
      }));

      const formattedCreatives = Object.values(creativeGroups).map((ad: any) => ({
        ...ad,
        cpl: ad.leads > 0 ? ad.spend / ad.leads : 0,
        ctr: ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0,
      }));

      const formattedDaily = Object.values(dailyGroups)
        .map((day: any) => ({
          ...day,
          cpl: day.leads > 0 ? day.spend / day.leads : 0,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setCampaigns(formattedCampaigns);
      setCreatives(formattedCreatives);
      setDailyMetrics(formattedDaily);

      setKpis({
        investido: totalSpend,
        leads: totalLeads,
        impressions: totalImpressions,
        clicks: totalClicks,
        reach: totalReach,
        cpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
        ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
        crm_leads: crmData?.length || 0,
        sales: 0,
        revenue: 0,
      });

    } catch (error) {
      console.error("Erro useDashboardData:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange, refreshTrigger]);

  return { 
    data: campaigns, 
    creatives,
    dailyMetrics,
    rawMetrics, // Exportando para uso no filtro dinâmico
    isLoading, 
    kpis, 
    fetchDashboardData 
  };
};