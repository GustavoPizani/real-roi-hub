-- Add campanha_nome column to crm_leads table
ALTER TABLE public.crm_leads 
ADD COLUMN IF NOT EXISTS campanha_nome TEXT;