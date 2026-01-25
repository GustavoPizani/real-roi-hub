// @ts-nocheck - This file runs in Deno environment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Definição dos cabeçalhos CORS para permitir requisições de qualquer origem
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Interface atualizada para incluir 'actions'
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
  // O Meta pode mandar leads aqui (pixel) ou em actions (formulários)
  conversions?: { action_type: string; value: string }[];
  actions?: { action_type: string; value: string }[]; 
  inline_link_click_ctr?: string;
  frequency?: string;
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
    const requestBody = await req.json();
    const { adAccountId, accessToken, since, until, selectedCampaign } = requestBody;

    console.log("========================================");
    console.log("[META-INSIGHTS] 1. INICIANDO SINCRONIZAÇÃO (MODO FORMULÁRIO):");
    console.log(`Conta: ${adAccountId} | Periodo: ${since} a ${until}`);
    console.log("========================================");

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

    // ADICIONADO 'actions' NA REQUISIÇÃO
    const fields = 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,reach,actions,conversions,cpc,ctr,inline_link_click_ctr,frequency';

    const time_range = JSON.stringify({ since, until });

    let allInsights: Insight[] = [];
    let url: string | undefined = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?level=ad&fields=${fields}&time_range=${time_range}&time_increment=1&access_token=${accessToken}&limit=500`;

    // Loop para lidar com a paginação da API da Meta
    let pageCount = 0;
    while (url) {
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        console.error("[META-INSIGHTS] Erro API Meta:", JSON.stringify(data.error));
        throw new Error(data.error?.message || "Falha ao consultar a API do Facebook.");
      }
      
      allInsights.push(...data.data);
      url = data.paging?.next;
      pageCount++;
    }    
    // Batch fetch ad creative details (thumbnail_url e creative_id)
    const adIds = allInsights.map(i => i.ad_id).filter(Boolean);
    const creativeDetailsMap = new Map<string, { creative_id?: string; thumbnail_url?: string }>();

    if (adIds.length > 0) {
      const batchRequests = adIds.map(adId => ({
        method: 'GET',
        relative_url: `${adId}?fields=creative{id,image_url,thumbnail_url}`
      }));

      const CHUNK_SIZE = 50;
      for (let i = 0; i < batchRequests.length; i += CHUNK_SIZE) {
        const chunk = batchRequests.slice(i, i + CHUNK_SIZE);
        const batchUrl = `https://graph.facebook.com/v18.0?batch=${encodeURIComponent(JSON.stringify(chunk))}&access_token=${accessToken}&include_headers=false`;

        try {
          const batchRes = await fetch(batchUrl, { method: 'POST' });
          const batchData = await batchRes.json();
          if (batchRes.ok) {
            batchData.forEach((item: any, index: number) => {
              if (item.code === 200) {
                const body = JSON.parse(item.body);
                const creative = body.creative || body.adcreatives?.data?.[0];
                if (creative) {
                  creativeDetailsMap.set(adIds[i + index], {
                    creative_id: creative.id,
                    thumbnail_url: creative.image_url || creative.thumbnail_url
                  });
                }
              }
            });
          }
        } catch (e) {
          console.error("Erro thumbnails:", e);
        }
      }
    }

    if (allInsights.length === 0) {
      console.log("[META-INSIGHTS] Nenhum insight encontrado para o período");
      return new Response(JSON.stringify({ adsData: [], kpis: {}, channelsData: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Mapeia os dados da API para o formato da tabela 'campaign_metrics'
    const metricsToUpsert = allInsights.map((insight) => {
      
      // --- LÓGICA DE LEADS CORRIGIDA PARA FORMULÁRIOS ---
      // Combina 'actions' e 'conversions' para não perder nada
      const allEvents = [
        ...(insight.actions || []), 
        ...(insight.conversions || [])
      ];

      // Lista de tipos aceitos como LEAD
      const validLeadTypes = [
        'lead',             // Padrãozão do Meta (geralmente soma tudo)
        'on_facebook_lead', // ESPECÍFICO para Formulários Nativos (Lead Ads)
        'leadgen_grouped',  // Agrupado
        'contact',
        'submit_application',
        'offsite_conversion.fb_pixel_lead'
      ];

      // Filtra e soma (evita duplicidade se o mesmo evento vier com nomes diferentes? 
      // O Meta geralmente separa. Para garantir, pegamos o 'lead' que costuma ser o totalizador, 
      // ou somamos tipos específicos se 'lead' não existir.
      // Estratégia segura: Somar apenas 'lead' se existir, pois ele agrega. Se for 0, tentar os específicos.
      
      let totalLeads = 0;
      
      // Tenta achar o totalizador 'lead' primeiro (mais seguro para evitar dupla contagem)
      const genericLead = allEvents.find(c => c.action_type === 'lead');
      
      if (genericLead) {
         totalLeads = parseInt(genericLead.value || "0", 10);
      } else {
         // Se não tem o genérico, soma os específicos (ex: on_facebook_lead)
         const specificLeads = allEvents.filter(c => 
            validLeadTypes.includes(c.action_type) && c.action_type !== 'lead'
         );
         totalLeads = specificLeads.reduce((acc, curr) => acc + parseInt(curr.value || "0", 10), 0);
      }

      // LOG DE DIAGNÓSTICO SE HOUVER LEADS
      if (totalLeads > 0) {
        console.log(`[SUCESSO] Campanha: ${insight.campaign_name} | Leads encontrados: ${totalLeads}`);
      }
      // --------------------------------------------------

      const creativeDetails = creativeDetailsMap.get(insight.ad_id);

      return {
        user_id: user.id,
        campaign_name: insight.campaign_name,
        ad_set_name: insight.adset_name,
        ad_name: insight.ad_name,
        creative_name: insight.ad_name, // Usa ad_name como creative_name
        thumbnail_url: creativeDetails?.thumbnail_url || null,
        date: insight.date_start,
        spend: parseFloat(insight.spend || "0"),
        impressions: parseInt(insight.impressions || "0", 10),
        clicks: parseInt(insight.clicks || "0", 10),
        reach: parseInt(insight.reach || "0", 10),
        cpc: parseFloat(insight.cpc || "0"),
        ctr: parseFloat(insight.ctr || "0"),
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
    // Usamos o índice único: user_id, campaign_name, ad_name, date
    const { error: upsertError } = await supabaseClient
      .from("campaign_metrics")
      .upsert(metricsToUpsert, { 
        onConflict: "user_id,campaign_name,ad_name,date",
        ignoreDuplicates: false 
      });

    if (upsertError) {
      console.error("Erro Upsert:", upsertError);
    }

    // Prepara os dados para retornar ao frontend no formato esperado pelo hook
    const adsData = metricsToUpsert.map(m => ({
      campaign_name: m.campaign_name,
      spend: m.spend,
      conversions: m.leads,
    }));

    const totalSpent = metricsToUpsert.reduce((sum, m) => sum + m.spend, 0);
    const totalLeads = metricsToUpsert.reduce((sum, m) => sum + m.leads, 0);

    const kpis = {
      investido: totalSpent, leads: totalLeads
    };

    const channelsData = [{
        name: 'Meta',
        value: totalSpent
    }];

    console.log("[META-INSIGHTS] FINALIZADO. Leads Totais:", totalLeads);

    return new Response(
      JSON.stringify({ adsData, kpis, channelsData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[META-INSIGHTS] ERRO FATAL:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
