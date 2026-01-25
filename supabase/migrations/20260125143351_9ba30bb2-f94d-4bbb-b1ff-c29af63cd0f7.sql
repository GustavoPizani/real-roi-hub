-- Adiciona um índice único para permitir upsert por user_id, campaign_name, ad_name e date
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_metrics_unique_record 
ON public.campaign_metrics (user_id, campaign_name, ad_name, date);

-- Adiciona índice para melhorar performance de buscas por creative_name
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_creative 
ON public.campaign_metrics (creative_name);

-- Adiciona índice para buscas por ad_name
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_ad_name 
ON public.campaign_metrics (ad_name);