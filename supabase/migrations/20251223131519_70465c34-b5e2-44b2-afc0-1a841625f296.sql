-- Create table for encrypted API settings
CREATE TABLE public.api_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  setting_key TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, setting_key)
);

-- Create table for CRM leads (from CSV uploads)
CREATE TABLE public.crm_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  fac_id TEXT,
  email TEXT,
  nome TEXT,
  telefone TEXT,
  empreendimento TEXT,
  situacao_atendimento TEXT,
  canal TEXT,
  corretor TEXT,
  cadastro TIMESTAMP WITH TIME ZONE,
  atualizacao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for ad metrics cache
CREATE TABLE public.ad_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ad_id TEXT NOT NULL,
  ad_name TEXT,
  thumbnail_url TEXT,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  spend DECIMAL(10,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  cost_per_result DECIMAL(10,2) DEFAULT 0,
  date_start DATE,
  date_stop DATE,
  device TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for AI chat history
CREATE TABLE public.ai_chat_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.api_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for api_settings
CREATE POLICY "Users can view their own API settings" ON public.api_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own API settings" ON public.api_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own API settings" ON public.api_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own API settings" ON public.api_settings FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for crm_leads
CREATE POLICY "Users can view their own leads" ON public.crm_leads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own leads" ON public.crm_leads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own leads" ON public.crm_leads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own leads" ON public.crm_leads FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for ad_metrics
CREATE POLICY "Users can view their own ad metrics" ON public.ad_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own ad metrics" ON public.ad_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own ad metrics" ON public.ad_metrics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own ad metrics" ON public.ad_metrics FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for ai_chat_history
CREATE POLICY "Users can view their own chat history" ON public.ai_chat_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own chat messages" ON public.ai_chat_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own chat history" ON public.ai_chat_history FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers for updated_at
CREATE TRIGGER update_api_settings_updated_at BEFORE UPDATE ON public.api_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_crm_leads_updated_at BEFORE UPDATE ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ad_metrics_updated_at BEFORE UPDATE ON public.ad_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();