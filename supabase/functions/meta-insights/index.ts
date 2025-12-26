const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { accessToken, adAccountId, datePreset = "last_30d" } = await req.json();

    if (!accessToken || !adAccountId) {
      return new Response(
        JSON.stringify({ error: "Missing access token or ad account ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("Fetching Meta insights for account:", adAccountId);

    // Fetch account insights
    const insightsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights`;
    const insightsParams = new URLSearchParams({
      access_token: accessToken,
      date_preset: datePreset,
      fields: "spend,impressions,clicks,actions,cost_per_action_type",
      level: "account",
    });

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
    const adsUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/ads`;
    const adsParams = new URLSearchParams({
      access_token: accessToken,
      date_preset: datePreset,
      fields: "id,name,creative{thumbnail_url},insights{spend,impressions,clicks,actions,cost_per_action_type}",
      limit: "50",
    });

    const adsResponse = await fetch(`${adsUrl}?${adsParams}`);
    const adsData = await adsResponse.json();

    // Fetch insights breakdown by device
    const deviceParams = new URLSearchParams({
      access_token: accessToken,
      date_preset: datePreset,
      fields: "impressions",
      breakdowns: "device_platform",
      level: "account",
    });

    const deviceResponse = await fetch(`${insightsUrl}?${deviceParams}`);
    const deviceData = await deviceResponse.json();

    // Fetch insights breakdown by hour
    const hourParams = new URLSearchParams({
      access_token: accessToken,
      date_preset: datePreset,
      fields: "impressions",
      breakdowns: "hourly_stats_aggregated_by_audience_time_zone",
      level: "account",
    });

    const hourResponse = await fetch(`${insightsUrl}?${hourParams}`);
    const hourData = await hourResponse.json();

    // Fetch daily insights for temporal chart
    const dailyParams = new URLSearchParams({
      access_token: accessToken,
      date_preset: datePreset,
      fields: "spend,actions",
      time_increment: "1",
      level: "account",
    });

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
    const devicesBreakdown = (deviceData.data || []).map((item: any) => ({
      name: item.device_platform || "Unknown",
      value: parseInt(item.impressions || "0"),
    }));

    // Process hourly data into periods
    const periods = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    (hourData.data || []).forEach((item: any) => {
      const hour = parseInt(item.hourly_stats_aggregated_by_audience_time_zone || "0");
      const impressions = parseInt(item.impressions || "0");
      if (hour >= 6 && hour < 12) periods.morning += impressions;
      else if (hour >= 12 && hour < 18) periods.afternoon += impressions;
      else if (hour >= 18 && hour < 22) periods.evening += impressions;
      else periods.night += impressions;
    });

    const periodData = [
      { period: "Manhã", value: periods.morning },
      { period: "Tarde", value: periods.afternoon },
      { period: "Noite", value: periods.evening },
      { period: "Madrugada", value: periods.night },
    ];

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
        devicesData: devicesBreakdown,
        periodData,
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
