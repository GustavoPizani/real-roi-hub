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
  adset_id: string;
  adset_name: string;
  ad_id: string;
  ad_name: string;
  date_start: string;
  spend: string;
  impressions: string;
  clicks: string;
  reach: string;
  cpc: string;
  ctr: string;
  conversions?: { action_type: string; value: string }[];
  inline_link_click_ctr?: string;
  frequency?: string;
  // Este campo não vem do insight, mas é adicionado posteriormente
  ad_creative?: {
    thumbnail_url?: string;
    id?: string;
  };
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
    const fields = 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,reach,conversions,cpc,ctr,inline_link_click_ctr,frequency';

    const time_range = JSON.stringify({ since, until });

    let allInsights: Insight[] = [];
    let url: string | undefined = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?level=ad&fields=${fields}&time_range=${time_range}&time_increment=1&access_token=${accessToken}&limit=500`;

    // Loop para lidar com a paginação da API da Meta
    while (url) {
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        console.error("Erro exato da API do Facebook:", JSON.stringify(data.error, null, 2));
        throw new Error(data.error?.message || "Falha ao consultar a API do Facebook.");
      }
      
      allInsights.push(...data.data);
      url = data.paging?.next;
    }
    
    // Batch fetch ad creative details (thumbnail_url e creative_id)
    const adIds = allInsights.map(i => i.ad_id).filter(Boolean);
    const creativeDetailsMap = new Map<string, { creative_id?: string; thumbnail_url?: string }>();

    if (adIds.length > 0) {
      const batchRequests = adIds.map(adId => ({
        method: 'GET',
        relative_url: `${adId}?fields=creative{id,image_url,thumbnail_url}`
      }));

      const CHUNK_SIZE = 50; // Limite da API para requisições em lote
      for (let i = 0; i < batchRequests.length; i += CHUNK_SIZE) {
        const chunk = batchRequests.slice(i, i + CHUNK_SIZE);
        const batchUrl = `https://graph.facebook.com/v18.0?batch=${encodeURIComponent(JSON.stringify(chunk))}&access_token=${accessToken}&include_headers=false`;

        try {
          const batchRes = await fetch(batchUrl, { method: 'POST' });
          const batchData = await batchRes.json();

          if (!batchRes.ok) {
            console.warn(`Falha no batch de thumbnails com status ${batchRes.status}`, batchData);
            continue;
          }

          batchData.forEach((item: any, index: number) => {
            const adId = adIds[i + index];
            if (item.code === 200) {
              const body = JSON.parse(item.body);
              // Mudança: O Facebook v18+ usa 'creative' em vez de 'adcreatives' em muitos casos de insights
              const creative = body.creative || body.adcreatives?.data?.[0];
              if (creative) {
                creativeDetailsMap.set(adId, {
                  creative_id: creative.id,
                  thumbnail_url: creative.image_url || creative.thumbnail_url
                });
              }
            }
          });
        } catch (e) {
          console.error(`Erro durante o batch de thumbnails para o chunk a partir do índice ${i}:`, e.message);
        }
      }
    }

    if (allInsights.length === 0) {
      return new Response(JSON.stringify({ adsData: [], kpis: {}, channelsData: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Mapeia os dados da API para o formato da tabela 'campaign_metrics'
    const metricsToUpsert = allInsights.map((insight) => {
      // Filtra por múltiplos tipos de leads e soma os valores
      const leadActions = insight.conversions?.filter(c => 
        ['lead', 'offsite_conversion.fb_pixel_lead', 'contact', 'leadgen_grouped'].includes(c.action_type)
      );
      const totalLeads = leadActions?.reduce((acc, curr) => acc + parseInt(curr.value || "0", 10), 0) || 0;

      const creativeDetails = creativeDetailsMap.get(insight.ad_id);

      return {
        user_id: user.id,
        campaign_id: insight.campaign_id,
        campaign_name: insight.campaign_name,
        adset_id: insight.adset_id,
        adset_name: insight.adset_name,
        ad_id: insight.ad_id,
        ad_name: insight.ad_name,
        creative_id: creativeDetails?.creative_id,
        thumbnail_url: creativeDetails?.thumbnail_url || null,
        date: insight.date_start,
        spend: parseFloat(insight.spend || "0"),
        impressions: parseInt(insight.impressions || "0", 10),
        clicks: parseInt(insight.clicks || "0", 10),
        reach: parseInt(insight.reach || "0", 10),
        cpc: parseFloat(insight.cpc || "0"),
        ctr: parseFloat(insight.ctr || "0"),
        inline_link_click_ctr: parseFloat(insight.inline_link_click_ctr || "0"),
        frequency: parseFloat(insight.frequency || "0"),
        leads: totalLeads,
        cpl: totalLeads > 0 ? parseFloat(insight.spend || "0") / totalLeads : 0,
        channel: 'meta',
        link_clicks: parseInt(insight.clicks || "0", 10),
        unique_link_clicks: 0,
        conversions: totalLeads,
      };
    });

    // Executa o "Upsert" no Supabase para evitar duplicidade
    const { error: upsertError } = await supabaseClient
      .from("campaign_metrics")
      .upsert(metricsToUpsert, { onConflict: "user_id,ad_id,date" });

    if (upsertError) {
      console.error("Supabase Upsert Error:", upsertError);
      throw new Error("Falha ao salvar métricas no banco de dados.");
    }

    // Prepara os dados para retornar ao frontend no formato esperado pelo hook
    const adsData = metricsToUpsert.map(m => ({
      campaign_name: m.campaign_name, // Garante consistência da chave (snake_case)
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