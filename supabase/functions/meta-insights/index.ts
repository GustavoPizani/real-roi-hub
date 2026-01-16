// @ts-nocheck - This file runs in Deno environment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Definição dos cabeçalhos CORS para permitir requisições de qualquer origem
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Interface para tipar os dados brutos da API da Meta
interface Insight {
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  spend: string;
  impressions: string;
  clicks: string;
  reach: string;
  cpc: string;
  cpm: string;
  ctr: string;
  frequency: string;
  actions?: { action_type: string; value: string }[];
}

serve(async (req) => {
  // Trata a requisição pre-flight OPTIONS para CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Extrai os parâmetros do corpo da requisição
    const { adAccountId, accessToken, since, until } = await req.json();

    // Cria um cliente Supabase com as permissões do usuário que fez a chamada
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    
    // Valida a sessão do usuário
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Define os campos que serão buscados na API de Insights
    const fields = [
      "campaign_id", "campaign_name", "spend", "impressions", "clicks",
      "reach", "cpc", "cpm", "ctr", "frequency", "actions"
    ].join(",");

    const time_range = JSON.stringify({ since, until });

    let allInsights: Insight[] = [];
    let url: string | undefined = `https://graph.facebook.com/v19.0/act_${adAccountId}/insights?level=campaign&fields=${fields}&time_range=${time_range}&time_increment=1&access_token=${accessToken}&limit=500`;

    // Loop para lidar com a paginação da API da Meta
    while (url) {
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        console.error("Facebook API Error:", data.error);
        throw new Error(data.error.message || "Falha ao consultar a API do Facebook.");
      }
      
      allInsights.push(...data.data);
      url = data.paging?.next;
    }
    
    if (allInsights.length === 0) {
      return new Response(JSON.stringify({ adsData: [], kpis: {}, channelsData: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Mapeia os dados da API para o formato da tabela 'campaign_metrics'
    const metricsToUpsert = allInsights.map((insight) => {
      const getActionValue = (actionType: string): number => {
        const action = insight.actions?.find(a => a.action_type === actionType);
        return action ? parseInt(action.value, 10) : 0;
      };
      
      const leads = getActionValue("lead") + getActionValue("onsite_conversion.post_save");

      return {
        user_id: user.id,
        campaign_id: insight.campaign_id,
        campaign_name: insight.campaign_name,
        date: insight.date_start,
        spend: parseFloat(insight.spend || "0"),
        impressions: parseInt(insight.impressions || "0", 10),
        clicks: parseInt(insight.clicks || "0", 10),
        reach: parseInt(insight.reach || "0", 10),
        cpc: parseFloat(insight.cpc || "0"),
        cpm: parseFloat(insight.cpm || "0"),
        ctr: parseFloat(insight.ctr || "0"),
        frequency: parseFloat(insight.frequency || "0"),
        leads: leads,
        cpl: leads > 0 ? parseFloat(insight.spend || "0") / leads : 0,
        channel: 'meta',
        link_clicks: parseInt(insight.clicks || "0", 10),
        unique_link_clicks: 0,
        conversions: leads,
      };
    });

    // Executa o "Upsert" no Supabase para evitar duplicidade
    const { error: upsertError } = await supabaseClient
      .from("campaign_metrics")
      .upsert(metricsToUpsert, { onConflict: "user_id,campaign_id,date" });

    if (upsertError) {
      console.error("Supabase Upsert Error:", upsertError);
      throw new Error("Falha ao salvar métricas no banco de dados.");
    }

    // Prepara os dados para retornar ao frontend no formato esperado pelo hook
    const adsData = metricsToUpsert.map(m => ({
      campaignName: m.campaign_name,
      spend: m.spend,
      conversions: m.leads,
    }));

    const totalSpent = metricsToUpsert.reduce((sum, m) => sum + m.spend, 0);

    const kpis = {
      investido: totalSpent,
    };

    const channelsData = [{
        name: 'Meta',
        value: totalSpent
    }];

    return new Response(
      JSON.stringify({ adsData, kpis, channelsData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});