// @ts-nocheck - This file runs in Deno environment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Definição dos cabeçalhos CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Interface mantida
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
  actions?: { action_type: string; value: string }[]; 
  inline_link_click_ctr?: string;
  frequency?: string;
  ad_creative?: {
    thumbnail_url?: string;
    id?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    // Suporte para múltiplos IDs: aceita array ou string única
    let { adAccountId, adAccountIds, accessToken, since, until } = requestBody;
    
    // Unifica para array
    const accountsToProcess = adAccountIds || (adAccountId ? [adAccountId] : []);

    console.log("========================================");
    console.log(`[META-INSIGHTS] INICIANDO PARALELO (${accountsToProcess.length} CONTAS)`);
    console.log(`Período: ${since} a ${until}`);
    console.log("========================================");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const fields = 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,reach,actions,conversions,cpc,ctr,inline_link_click_ctr,frequency';
    const time_range = JSON.stringify({ since, until });

    // --- FUNÇÃO PARA PROCESSAR UMA ÚNICA CONTA ---
    const processAccount = async (accountId: string) => {
        let accountInsights: Insight[] = [];
        let url: string | undefined = `https://graph.facebook.com/v18.0/act_${accountId.trim()}/insights?level=ad&fields=${fields}&time_range=${time_range}&time_increment=1&access_token=${accessToken}&limit=500`;

        try {
            while (url) {
                const response = await fetch(url);
                const data = await response.json();

                if (!response.ok) {
                    console.error(`[ERRO CONTA ${accountId}]`, data.error?.message);
                    return []; // Retorna vazio se falhar, não trava as outras
                }
                
                if (data.data) accountInsights.push(...data.data);
                url = data.paging?.next;
            }
            return accountInsights;
        } catch (err) {
            console.error(`[FALHA FATAL CONTA ${accountId}]`, err);
            return [];
        }
    };

    // --- PARALELISMO: Dispara todas as contas simultaneamente ---
    const results = await Promise.all(accountsToProcess.map((id: string) => processAccount(id)));
    const allInsights = results.flat(); // Junta tudo num array só

    // --- LÓGICA DE THUMBNAILS (MANTIDA) ---
    // Batch fetch ad creative details
    const adIds = [...new Set(allInsights.map(i => i.ad_id).filter(Boolean))]; // Set para evitar duplicatas
    const creativeDetailsMap = new Map<string, { creative_id?: string; thumbnail_url?: string }>();

    if (adIds.length > 0) {
      // Divide em chunks maiores para acelerar (API batch aceita até 50 requisições)
      const CHUNK_SIZE = 50; 
      // Processa chunks de thumbnails em paralelo também para máxima velocidade
      const thumbnailPromises = [];
      
      for (let i = 0; i < adIds.length; i += CHUNK_SIZE) {
        const chunk = adIds.slice(i, i + CHUNK_SIZE);
        const batchRequests = chunk.map(adId => ({
            method: 'GET',
            relative_url: `${adId}?fields=creative{id,image_url,thumbnail_url}`
        }));
        
        const batchUrl = `https://graph.facebook.com/v18.0?batch=${encodeURIComponent(JSON.stringify(batchRequests))}&access_token=${accessToken}&include_headers=false`;
        
        thumbnailPromises.push(
            fetch(batchUrl, { method: 'POST' })
            .then(res => res.json())
            .then(batchData => {
                if (Array.isArray(batchData)) {
                    batchData.forEach((item: any, idx: number) => {
                        if (item.code === 200) {
                            const body = JSON.parse(item.body);
                            const creative = body.creative || body.adcreatives?.data?.[0];
                            if (creative) {
                                creativeDetailsMap.set(chunk[idx], {
                                    creative_id: creative.id,
                                    thumbnail_url: creative.image_url || creative.thumbnail_url
                                });
                            }
                        }
                    });
                }
            })
            .catch(e => console.error("Erro batch thumb:", e))
        );
      }
      await Promise.all(thumbnailPromises);
    }

    if (allInsights.length === 0) {
      return new Response(JSON.stringify({ adsData: [], kpis: {}, channelsData: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // --- MAP E UPSERT (MANTIDOS) ---
    const metricsToUpsert = allInsights.map((insight) => {
      const allEvents = [ ...(insight.actions || []), ...(insight.conversions || []) ];
      const validLeadTypes = ['lead', 'on_facebook_lead', 'leadgen_grouped', 'contact', 'submit_application', 'offsite_conversion.fb_pixel_lead'];
      
      let totalLeads = 0;
      const genericLead = allEvents.find(c => c.action_type === 'lead');
      
      if (genericLead) {
         totalLeads = parseInt(genericLead.value || "0", 10);
      } else {
         const specificLeads = allEvents.filter(c => validLeadTypes.includes(c.action_type) && c.action_type !== 'lead');
         totalLeads = specificLeads.reduce((acc, curr) => acc + parseInt(curr.value || "0", 10), 0);
      }

      const creativeDetails = creativeDetailsMap.get(insight.ad_id);

      return {
        user_id: user.id,
        campaign_name: insight.campaign_name,
        ad_set_name: insight.adset_name,
        ad_name: insight.ad_name,
        creative_name: insight.ad_name,
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

    const { error: upsertError } = await supabaseClient
      .from("campaign_metrics")
      .upsert(metricsToUpsert, { 
        onConflict: "user_id,campaign_name,ad_name,date",
        ignoreDuplicates: false 
      });

    if (upsertError) console.error("Erro Upsert:", upsertError);

    // Retorno para frontend
    const adsData = metricsToUpsert.map(m => ({
      campaign_name: m.campaign_name,
      spend: m.spend,
      conversions: m.leads,
    }));

    const totalSpent = metricsToUpsert.reduce((sum, m) => sum + m.spend, 0);
    const totalLeads = metricsToUpsert.reduce((sum, m) => sum + m.leads, 0);

    console.log(`[SUCESSO TOTAL] ${metricsToUpsert.length} linhas processadas. Leads: ${totalLeads}`);

    return new Response(
      JSON.stringify({ 
          adsData, 
          kpis: { investido: totalSpent, leads: totalLeads }, 
          channelsData: [{ name: 'Meta', value: totalSpent }] 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[ERRO GERAL]:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});