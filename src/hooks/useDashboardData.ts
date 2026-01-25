import { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths } from "date-fns";

export const useDashboardData = (dateRange?: DateRange, refreshTrigger?: number) => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [kpis, setKpis] = useState({
    investido: 0,
    impressions: 0,
    clicks: 0,
    leads: 0, // Usaremos este campo unificado
    reach: 0,
    cpl: 0,
    ctr: 0,
    cpc: 0,
    crm_leads: 0,
    sales: 0,
    revenue: 0,
  });

  // Função auxiliar para garantir números válidos
  const safeNumber = (val: any) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Busca dados do Meta (Tabela campaign_metrics)
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

      // 2. Busca dados do CRM (Tabela crm_leads)
      let crmQuery = supabase
        .from("crm_leads")
        .select("*")
        .eq("user_id", user.id);
        
      if (dateRange?.from) {
        crmQuery = crmQuery.gte("data_cadastro", format(dateRange.from, "yyyy-MM-dd"));
      }
      if (dateRange?.to) {
        crmQuery = crmQuery.lte("data_cadastro", format(dateRange.to, "yyyy-MM-dd"));
      }

      const { data: crmData, error: crmError } = await crmQuery;
      if (crmError) throw crmError;

      // 3. Processamento e Agregação (AQUI ESTÁ A MÁGICA)
      // Agrupamos por campanha para a Tabela de Campanhas
      const campaignGroups: Record<string, any> = {};
      
      // Acumuladores Gerais para os KPIs do Topo
      let totalSpend = 0;
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalLeads = 0;
      let totalReach = 0;

      (metricsData || []).forEach((row) => {
        const campName = row.campaign_name || "Sem Nome";
        
        // Garante que estamos somando números
        const spend = safeNumber(row.spend);
        const leads = safeNumber(row.leads); // Agora lendo a coluna certa!
        const impressions = safeNumber(row.impressions);
        const clicks = safeNumber(row.clicks);
        const reach = safeNumber(row.reach);

        // Somar nos KPIs Gerais
        totalSpend += spend;
        totalLeads += leads;
        totalImpressions += impressions;
        totalClicks += clicks;
        totalReach += reach;

        // Agrupar por Campanha
        if (!campaignGroups[campName]) {
          campaignGroups[campName] = {
            campaign_name: campName,
            spend: 0,
            leads: 0,
            impressions: 0,
            clicks: 0,
            reach: 0,
            // Campos calculados depois
            cpl: 0,
            ctr: 0,
            cpc: 0
          };
        }

        campaignGroups[campName].spend += spend;
        campaignGroups[campName].leads += leads;
        campaignGroups[campName].impressions += impressions;
        campaignGroups[campName].clicks += clicks;
        campaignGroups[campName].reach += reach;
      });

      // Transforma o objeto agrupado em array e calcula as médias (CTR, CPC, CPL)
      const formattedCampaigns = Object.values(campaignGroups).map((camp: any) => ({
        ...camp,
        cpl: camp.leads > 0 ? camp.spend / camp.leads : 0,
        ctr: camp.impressions > 0 ? (camp.clicks / camp.impressions) * 100 : 0,
        cpc: camp.clicks > 0 ? camp.spend / camp.clicks : 0,
      }));

      // Atualiza o estado da Tabela
      setData(formattedCampaigns);

      // Atualiza o estado dos KPIs
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
        sales: 0, // Implementar lógica de vendas se houver coluna no CRM
        revenue: 0,
      });

    } catch (error) {
      console.error("Erro ao buscar dados do dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange, refreshTrigger]);

  return { data, isLoading, kpis, fetchDashboardData };
};
