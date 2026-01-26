// @ts-nocheck - Deno environment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configuração de Lote: Processa 3 contas por vez para não estourar a memória RAM da Edge Function
const BATCH_SIZE = 3; 

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const requestBody = await req.json();
    let { adAccountId, adAccountIds, accessToken, since, until } = requestBody;
    
    // Garante que temos uma lista de contas
    const accountsToProcess = adAccountIds || (adAccountId ? [adAccountId] : []);
    const uniqueAccounts = [...new Set(accountsToProcess)]; // Remove duplicados

    console.log(`[META-INSIGHTS] Iniciando processamento de ${uniqueAccounts.length} contas.`);
    console.log(`[CONFIG] Modo Lote: ${BATCH_SIZE} contas por vez.`);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const fields = 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,reach,actions,conversions,cpc,ctr,inline_link_click_ctr,frequency';
    const time_range = JSON.stringify({ since, until });

    // Função auxiliar para processar uma única conta
    const processAccount = async (accountId) => {
        let accountInsights = [];
        let url = `https://graph.facebook.com/v18.0/act_${accountId.trim()}/insights?level=ad&fields=${fields}&time_range=${time_range}&time_increment=1&access_token=${accessToken}&limit=500`;

        try {
            while (url) {
                const response = await fetch(url);
                const data = await response.json();

                if (!response.ok) {
                    console.error(`[ERRO CONTA ${accountId}]: ${data.error?.message}`);
                    return { id: accountId, success: false, error: data.error?.message, data: [] };
                }
                
                if (data.data) accountInsights.push(...data.data);
                url = data.paging?.next;
            }
            return { id: accountId, success: true, data: accountInsights };
        } catch (err) {
            console.error(`[FALHA FATAL CONTA ${accountId}]:`, err);
            return { id: accountId, success: false, error: err.message, data: [] };
        }
    };

    // --- LÓGICA DE LOTES (BATCHING) ---
    let allInsights = [];
    let failedAccounts = [];

    for (let i = 0; i < uniqueAccounts.length; i += BATCH_SIZE) {
        const chunk = uniqueAccounts.slice(i, i + BATCH_SIZE);
        console.log(`Processando lote ${i / BATCH_SIZE + 1}: Contas ${chunk.join(', ')}`);
        
        // Processa o lote atual em paralelo
        const results = await Promise.all(chunk.map(id => processAccount(id)));
        
        results.forEach(res => {
            if (res.success) {
                allInsights.push(...res.data);
            } else {
                failedAccounts.push({ id: res.id, error: res.error });
            }
        });
    }

    console.log(`[RESUMO] Sucesso: ${uniqueAccounts.length - failedAccounts.length} | Falhas: ${failedAccounts.length}`);
    if (failedAccounts.length > 0) console.log("Contas com erro:", JSON.stringify(failedAccounts));

    // --- PROCESSAMENTO DE THUMBNAILS (MANTIDO) ---
    const adIds = [...new Set(allInsights.map(i => i.ad_id).filter(Boolean))];
    const creativeDetailsMap = new Map();

    if (adIds.length > 0) {
      const THUMB_CHUNK_SIZE = 50; 
      const thumbnailPromises = [];
      
      for (let i = 0; i < adIds.length; i += THUMB_CHUNK_SIZE) {
        const chunk = adIds.slice(i, i + THUMB_CHUNK_SIZE);
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
                    batchData.forEach((item, idx) => {
                        if (item.code === 200) {
                            const body = JSON.parse(item.body);
                            const creative = body.creative || body.adcreatives?.data?.[0];
                            if (creative) {
                                creativeDetailsMap.set(chunk[idx], {
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

    // --- MAPPING E UPSERT ---
    if (allInsights.length > 0) {
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
        
        // Calcular totais
        const totalSpent = metricsToUpsert.reduce((sum, m) => sum + m.spend, 0);
        const totalLeads = metricsToUpsert.reduce((sum, m) => sum + m.leads, 0);

        return new Response(
          JSON.stringify({ 
              success: true,
              processed_count: uniqueAccounts.length,
              failed_count: failedAccounts.length,
              failed_ids: failedAccounts,
              adsData: [], // O front já busca do banco, isso é opcional
              kpis: { investido: totalSpent, leads: totalLeads }
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } else {
        return new Response(
          JSON.stringify({ success: true, message: "Nenhum dado encontrado.", failed_ids: failedAccounts }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

  } catch (error) {
    console.error("[ERRO FATAL]:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});