const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { accessToken, adAccountId, since, until } = await req.json();

    if (!accessToken || !adAccountId) {
      console.error("Missing access token or ad account ID. accessToken:", !!accessToken, "adAccountId:", !!adAccountId);

      return new Response(
        JSON.stringify({ error: "Missing access token or ad account ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const time_range = since && until ? JSON.stringify({ since, until }) : undefined;
    let date_preset = !time_range ? 'last_30d' : undefined;

    if (since === "" || until === "") {
      console.warn("Empty 'since' or 'until' parameter received. Using 'last_30d' as fallback.");
      date_preset = "last_30d";
    }

    console.log(`Fetching Meta insights for account: ${adAccountId} with range: ${time_range || date_preset}`);

    // Fetch account insights
    const insightsUrl = `https://graph.facebook.com/v18.0/${adAccountId}/insights`;
    const insightsParams = new URLSearchParams({
      access_token: accessToken,
      fields: "spend,impressions,clicks,actions,cost_per_action_type",
      level: "account",
    });

    if (time_range) insightsParams.append('time_range', time_range);
    if (date_preset) insightsParams.append('date_preset', date_preset);

    const insightsResponse = await fetch(`${insightsUrl}?${insightsParams}`);
    const insightsData = await insightsResponse.json();

    if (insightsData.error) {
      console.error("Meta API error:", insightsData.error);
      return new Response(
        JSON.stringify({ error: insightsData.error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch ads with insights
    const adsUrl = `https://graph.facebook.com/v18.0/${adAccountId}/ads`;
    const adsParams = new URLSearchParams({
      access_token: accessToken,
      fields: "id,name,campaign{id,name},creative{thumbnail_url},insights{spend,impressions,clicks,actions,cost_per_action_type}",
      limit: "50",
    });

    if (time_range) adsParams.append('time_range', time_range);
    if (date_preset) adsParams.append('date_preset', date_preset);

    const adsResponse = await fetch(`${adsUrl}?${adsParams}`);
    const adsData = await adsResponse.json();

    // Fetch insights breakdown by device
    const deviceParams = new URLSearchParams({
      access_token: accessToken,
      fields: "impressions",
      breakdowns: "publisher_platform,platform_position",
      level: "account",
    });

    if (time_range) deviceParams.append('time_range', time_range);
    if (date_preset) deviceParams.append('date_preset', date_preset);

    const channelsResponse = await fetch(`${insightsUrl}?${deviceParams}`);
    const channelsDataRaw = await channelsResponse.json();
    
    // Fetch daily insights for temporal chart
    const dailyParams = new URLSearchParams({
      access_token: accessToken,
      fields: "spend,actions",
      time_increment: "1",
      level: "account",
    });

    if (time_range) dailyParams.append('time_range', time_range);
    if (date_preset) dailyParams.append('date_preset', date_preset);

    const dailyResponse = await fetch(`${insightsUrl}?${dailyParams}`);
    const dailyData = await dailyResponse.json();

    // Process account insights
    const accountInsight = insightsData.data?.[0] || {};
    const spend = parseFloat(accountInsight.spend || "0");
    const impressions = parseInt(accountInsight.impressions || "0");
    const clicks = parseInt(accountInsight.clicks || "0");
    
    // Find messaging/lead actions
    const actions = accountInsight.actions || [];
    const leadAction = actions.find((a: any) => a.action_type === "lead");
    const conversions = parseInt(leadAction?.value || "0");
    
    const costPerResult = conversions > 0 ? spend / conversions : 0;

    // Process device data
    const channelsBreakdown = (channelsDataRaw.data || []).map((item: any) => ({
      name: `${item.publisher_platform} ${item.platform_position}`.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: parseInt(item.impressions || "0"),
    }));

    // Process daily data for temporal chart
    const temporalData = (dailyData.data || []).map((item: any) => {
      const date = new Date(item.date_start);
      const leads = (item.actions || []).find((a: any) => a.action_type === "lead")?.value || 0;
      
      return {
        date: `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}`,
        investimento: parseFloat(item.spend || "0"),
        leads: parseInt(leads),
      };
    });

    // Process ads data
    const adsProcessed = (adsData.data || []).map((ad: any) => {
      const insight = ad.insights?.data?.[0] || {};
      const adActions = insight.actions || [];
      const adConversions = adActions.find((a: any) => a.action_type === "lead")?.value || 0;
      
      return {
        id: ad.id,
        name: ad.name,
        campaignId: ad.campaign?.id,
        campaignName: ad.campaign?.name,
        thumbnail_url: ad.creative?.thumbnail_url || null,
        impressions: parseInt(insight.impressions || "0"),
        clicks: parseInt(insight.clicks || "0"),
        spend: parseFloat(insight.spend || "0"),
        conversions: parseInt(adConversions),
        costPerResult: parseInt(adConversions) > 0 
          ? parseFloat(insight.spend || "0") / parseInt(adConversions) 
          : 0,
      };
    });

    return new Response(
      JSON.stringify({
        kpis: {
          investido: spend,
          resultado: conversions,
          custoPorResultado: costPerResult,
          impressions,
          clicks,
        },
        temporalData,
        channelsData: channelsBreakdown,
        adsData: adsProcessed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Meta insights error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
