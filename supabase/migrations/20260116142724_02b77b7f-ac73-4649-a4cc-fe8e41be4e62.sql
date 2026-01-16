-- Create table for campaign metrics from uploaded spreadsheets
CREATE TABLE IF NOT EXISTS public.campaign_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  campaign_name TEXT NOT NULL,
  ad_set_name TEXT,
  ad_name TEXT,
  creative_name TEXT,
  date DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  link_clicks BIGINT DEFAULT 0,
  unique_link_clicks BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  spend DECIMAL(12,2) DEFAULT 0,
  leads INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  ctr DECIMAL(8,4) DEFAULT 0,
  cpc DECIMAL(10,4) DEFAULT 0,
  cpm DECIMAL(10,4) DEFAULT 0,
  cpl DECIMAL(10,4) DEFAULT 0,
  frequency DECIMAL(6,2) DEFAULT 0,
  thumbnail_url TEXT,
  channel TEXT DEFAULT 'meta',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaign_metrics ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own campaign metrics" 
ON public.campaign_metrics 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaign metrics" 
ON public.campaign_metrics 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaign metrics" 
ON public.campaign_metrics 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaign metrics" 
ON public.campaign_metrics 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_campaign_metrics_user_date ON public.campaign_metrics(user_id, date);
CREATE INDEX idx_campaign_metrics_campaign ON public.campaign_metrics(campaign_name);

-- Add trigger for updated_at
CREATE TRIGGER update_campaign_metrics_updated_at
BEFORE UPDATE ON public.campaign_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();