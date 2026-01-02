// @ts-nocheck - This file runs in Deno environment

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // 1. Tratamento de CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Leitura Segura do Corpo (Igual ao seu meta-hook que funcionou)
    const bodyText = await req.text();
    if (!bodyText) {
      throw new Error("Corpo da requisição vazio");
    }
    
    let { accessToken, adAccountId, since, until } = JSON.parse(bodyText);

    // 3. Limpeza do ID da Conta
    if (!accessToken || !adAccountId) {
      throw new Error("Token ou ID da conta ausentes");
    }
    adAccountId = adAccountId.trim().replace('act_', '');

    console.log(`[INSIGHTS] Processando conta: ${adAccountId}`);

    const time_range = since && until ? JSON.stringify({ since, until }) : undefined;
    const date_preset = !time_range ? 'last_30d' : undefined;

    // 4. Busca de KPIs Principais
    const insightsUrl = `https://graph.facebook.com/v22.0/act_${adAccountId}/insights`;
    const insightsParams = new URLSearchParams({
      access_token: accessToken,
      fields: "spend,impressions,clicks,actions",
      level: "account",
    });
    if (time_range) insightsParams.append('time_range', time_range);
    if (date_preset) insightsParams.append('date_preset', date_preset);

    const insightsRes = await fetch(`${insightsUrl}?${insightsParams}`);
    const insightsData = await insightsRes.json();

    if (insightsData.error) throw new Error(insightsData.error.message);

    // 5. Busca por Campanha (Essencial para o match com CRM)
    // Usar o level: 'campaign' garante que o nome da campanha venha pronto para o Dashboard
    const campaignInsightsUrl = `https://graph.facebook.com/v22.0/act_${adAccountId}/insights`;
    const campaignParams = new URLSearchParams({
      access_token: accessToken,
      fields: "campaign_name,campaign_id,spend,actions",
      level: "campaign",
      limit: "500",
    });
    if (time_range) campaignParams.append('time_range', time_range);

    const campRes = await fetch(`${campaignInsightsUrl}?${campaignParams}`);
    const campData = await campRes.json();

    if (campData.error) throw new Error(campData.error.message);

    // 6. Busca de Canais
    const channelParams = new URLSearchParams({
      access_token: accessToken,
      fields: "impressions,spend",
      breakdowns: "publisher_platform,platform_position",
      level: "account",
    });
    if (time_range) channelParams.append('time_range', time_range);
    if (date_preset) channelParams.append('date_preset', date_preset);

    const channelsRes = await fetch(`${insightsUrl}?${channelParams}`);
    const channelsData = await channelsRes.json();

    // 7. Processamento dos Dados
    const accountInsight = insightsData.data?.[0] || {};
    const leadAction = (accountInsight.actions || []).find((a: any) => a.action_type === "lead");
    
    // Processamento focado em campanhas para o campaignsMap
    const adsProcessed = (campData.data || []).map((camp: any) => {
      const campLeads = (camp.actions || []).find((a: any) => a.action_type === "lead")?.value || 0;
      return {
        campaignId: camp.campaign_id,
        campaignName: camp.campaign_name, // Nome que o Dashboard usará para o match
        spend: parseFloat(camp.spend || "0"),
        conversions: parseInt(campLeads),
      };
    });

    const channelsProcessed = (channelsData.data || []).map((item: any) => ({
      name: `${item.publisher_platform} (${item.platform_position})`.replace(/_/g, ' '),
      value: parseInt(item.impressions || "0"),
    }));

    return new Response(
      JSON.stringify({
        kpis: {
          investido: parseFloat(accountInsight.spend || "0"),
          resultado: parseInt(leadAction?.value || "0"),
        },
        adsData: adsProcessed,
        channelsData: channelsProcessed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("[ERRO INSIGHTS]:", errorMessage);

    // Adicione dentro do catch (error: unknown)
    if (errorMessage.includes("OAuth") || errorMessage.includes("access token")) {
      return new Response(
        JSON.stringify({ error: "TOKEN_INVALIDO", detail: errorMessage }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});