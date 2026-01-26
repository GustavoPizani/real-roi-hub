// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 3; 

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const requestBody = await req.json();
    let { adAccountId, adAccountIds, accessToken, since, until } = requestBody;
    
    const accountsToProcess = adAccountIds || (adAccountId ? [adAccountId] : []);
    const uniqueAccounts = [...new Set(accountsToProcess)].map(id => String(id).trim());

    console.log(`[META-SYNC] Iniciando para ${uniqueAccounts.length} contas.`);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const fields = 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,reach,actions,conversions,cpc,ctr,frequency';
    const time_range = JSON.stringify({ since, until });

    // --- PROCESSAMENTO DA CONTA ---
    const processAccount = async (accountId) => {
        try {
            const accountUrl = `https://graph.facebook.com/v18.0/act_${accountId}?fields=name,currency&access_token=${accessToken}`;
            const accountRes = await fetch(accountUrl);
            const accountInfo = await accountRes.json();
            const accountName = accountInfo.name || `Conta ${accountId}`;
            
            let url = `https://graph.facebook.com/v18.0/act_${accountId}/insights?level=ad&fields=${fields}&time_range=${time_range}&time_increment=1&access_token=${accessToken}&limit=500`;
            
            const accountInsights = [];
            let hasData = false;

            while (url) {
                const response = await fetch(url);
                const data = await response.json();

                if (!response.ok) {
                    return { id: accountId, success: false, error: data.error?.message, data: [] };
                }
                
                if (data.data && data.data.length > 0) {
                    hasData = true;
                    const enrichedData = data.data.map(d => ({ ...d, account_name: accountName }));
                    accountInsights.push(...enrichedData);
                }
                url = data.paging?.next;
            }

            if (!hasData) {
                console.log(`[ZERO DATA] Placeholder para: ${accountName}`);
                return { 
                    id: accountId, 
                    success: true, 
                    data: [{
                        is_placeholder: true,
                        account_name: accountName,
                        campaign_name: "Sem Campanhas Ativas",
                        ad_name: "-",
                        date_start: since,
                        spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0
                    }]
                };
            }

            return { id: accountId, success: true, data: accountInsights };

        } catch (err) {
            return { id: accountId, success: false, error: err.message, data: [] };
        }
    };

    let allInsights = [];
    let failedAccounts = [];

    for (let i = 0; i < uniqueAccounts.length; i += BATCH_SIZE) {
        const chunk = uniqueAccounts.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(chunk.map(id => processAccount(id)));
        
        results.forEach(res => {
            if (res.success) allInsights.push(...res.data);
            else failedAccounts.push({ id: res.id, error: res.error });
        });
    }

    // --- THUMBNAILS ---
    const realAds = allInsights.filter(i => !i.is_placeholder);
    const adIds = [...new Set(realAds.map(i => i.ad_id).filter(Boolean))];
    const creativeDetailsMap = new Map();

    if (adIds.length > 0) {
        const THUMB_CHUNK = 50;
        const thumbPromises = [];
        for (let i = 0; i < adIds.length; i += THUMB_CHUNK) {
            const chunk = adIds.slice(i, i + THUMB_CHUNK);
            const batchReq = chunk.map(id => ({ method: 'GET', relative_url: `${id}?fields=creative{id,image_url,thumbnail_url}` }));
            const batchUrl = `https://graph.facebook.com/v18.0?batch=${encodeURIComponent(JSON.stringify(batchReq))}&access_token=${accessToken}`;
            
            thumbPromises.push(
                fetch(batchUrl, { method: 'POST' }).then(r => r.json()).then(resp => {
                     if (Array.isArray(resp)) {
                        resp.forEach((item, idx) => {
                            if (item.code === 200) {
                                const b = JSON.parse(item.body);
                                const c = b.creative || b.adcreatives?.data?.[0];
                                if (c) creativeDetailsMap.set(chunk[idx], { url: c.image_url || c.thumbnail_url });
                            }
                        });
                     }
                }).catch(e => console.error(e))
            );
        }
        await Promise.all(thumbPromises);
    }

    // --- SALVANDO NO BANCO (COM DEDUPLICAÇÃO) ---
    if (allInsights.length > 0) {
        const metricsToUpsert = allInsights.map((insight) => {
            if (insight.is_placeholder) {
                return {
                    user_id: user.id,
                    account_name: insight.account_name,
                    campaign_name: insight.campaign_name,
                    ad_name: insight.ad_name,
                    date: insight.date_start,
                    spend: 0, impressions: 0, clicks: 0, leads: 0,
                    thumbnail_url: null, channel: 'meta'
                };
            }

            const allEvents = [ ...(insight.actions || []), ...(insight.conversions || []) ];
            const validLeadTypes = ['lead', 'on_facebook_lead', 'contact', 'submit_application'];
            let totalLeads = 0;
            const genericLead = allEvents.find(c => c.action_type === 'lead');
            if (genericLead) totalLeads = parseInt(genericLead.value || "0");
            else totalLeads = allEvents.filter(c => validLeadTypes.includes(c.action_type)).reduce((acc, c) => acc + parseInt(c.value), 0);

            const creativeDetails = creativeDetailsMap.get(insight.ad_id);

            return {
                user_id: user.id,
                account_name: insight.account_name,
                campaign_name: insight.campaign_name,
                ad_name: insight.ad_name,
                date: insight.date_start,
                spend: parseFloat(insight.spend || "0"),
                impressions: parseInt(insight.impressions || "0"),
                clicks: parseInt(insight.clicks || "0"),
                leads: totalLeads,
                thumbnail_url: creativeDetails?.url || null,
                channel: 'meta',
                reach: parseInt(insight.reach || "0")
            };
        });

        // --- CORREÇÃO DO ERRO 21000: DEDUPLICAÇÃO MANUAL ---
        // Cria uma chave única para cada linha e remove duplicatas do array antes do upsert
        const uniqueMetricsMap = new Map();
        
        metricsToUpsert.forEach(item => {
            const key = `${item.user_id}|${item.campaign_name}|${item.ad_name}|${item.date}`;
            
            // Se já existe, substitui (comportamento de upsert "last wins")
            uniqueMetricsMap.set(key, item);
        });
        
        const deduplicatedMetrics = Array.from(uniqueMetricsMap.values());
        // --- GRAVAÇÃO COM CONSTRAINT RESTAURADA ---
        console.log(`[DB] Tentando salvar ${deduplicatedMetrics.length} linhas.`);

        // Limpa especificamente o que vamos inserir para evitar o erro "cannot affect row a second time"
        // Isso é mais seguro que apenas o upsert em casos de conflitos complexos
        const { error: upsertError } = await supabaseClient
            .from("campaign_metrics")
            .upsert(deduplicatedMetrics, {
                onConflict: "user_id,campaign_name,ad_name,date"
            })
            // .select(); // Removido para seguir a correção, dbData não será retornado

        if (upsertError) {
            console.error("❌ Erro fatal no Banco:", JSON.stringify(upsertError));
        } else {
            console.log(`✅ Sucesso! Dados persistidos.`);
        }
    }

    return new Response(JSON.stringify({
        success: true, 
        processed: uniqueAccounts.length, 
        failed: failedAccounts.length
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});