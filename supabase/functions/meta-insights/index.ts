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
    const insightsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights`;
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

    // 5. Busca de Anúncios e Campanhas (Requisito: Mapeamento por Campanha)
    const adsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/ads`;
    const adsParams = new URLSearchParams({
      access_token: accessToken,
      fields: "id,name,campaign{id,name},creative{thumbnail_url},insights{spend,impressions,clicks,actions}",
      limit: "100",
    });
    if (time_range) adsParams.append('time_range', time_range);
    if (date_preset) adsParams.append('date_preset', date_preset);

    const adsRes = await fetch(`${adsUrl}?${adsParams}`);
    const adsData = await adsRes.json();

    // 6. Busca de Canais (Requisito: Remover dispositivos e usar publisher_platform)
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
    
    const adsProcessed = (adsData.data || []).map((ad: any) => {
      const insight = ad.insights?.data?.[0] || {};
      const adLeads = (insight.actions || []).find((a: any) => a.action_type === "lead")?.value || 0;
      return {
        id: ad.id,
        name: ad.name,
        campaignId: ad.campaign?.id,
        campaignName: ad.campaign?.name,
        thumbnail_url: ad.creative?.thumbnail_url,
        spend: parseFloat(insight.spend || "0"),
        conversions: parseInt(adLeads),
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

  } catch (error) {
    console.error("[ERRO INSIGHTS]:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});