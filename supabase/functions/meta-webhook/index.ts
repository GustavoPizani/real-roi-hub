// @ts-nocheck - This file runs in Deno environment
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import CryptoJS from "https://esm.sh/crypto-js@4.2.0";

// Define CORS headers for preflight and response
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Decryption function to securely read secrets
const decrypt = (ciphertext: string, key: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
      throw new Error("Decryption resulted in an empty string.");
    }
    return decrypted;
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    console.error("Decryption failed:", errorMessage);
    return "";
  }
};

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const webhookVerifyToken = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN')
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY')

  // Handle Meta's webhook verification challenge
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === webhookVerifyToken) {
      console.log('Webhook verified successfully!')
      return new Response(challenge, { status: 200, headers: corsHeaders })
    } else {
      console.error('Webhook verification failed. Ensure META_WEBHOOK_VERIFY_TOKEN is set correctly.')
      return new Response('Forbidden', { status: 403, headers: corsHeaders })
    }
  }

  // Handle incoming lead data via POST request
  if (req.method === 'POST') {
    try {
      const bodyText = await req.text();
      if (!bodyText) {
        console.error('[WEBHOOK] Erro: Corpo da requisição vazio');
        return new Response('Empty body', { status: 400 });
      }
      const payload = JSON.parse(bodyText);
      console.log("1. Recebido da Meta:", JSON.stringify(payload));

      const userId = url.searchParams.get('user_id')
      if (!userId) {
        throw new Error('user_id ausente na URL')
      }
      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY environment variable is not set.')
      }

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )

      for (const entry of payload.entry) {
        if (!entry.changes) continue;
        for (const change of entry.changes) {
          if (change.field === 'leadgen') {
            const leadgenId = change.value.leadgen_id
            const createdTime = change.value.created_time
            console.log("2. Buscando detalhes do Lead ID:", leadgenId);
            
            const { data: settings, error: settingsError } = await supabaseAdmin
              .from('api_settings')
              .select('encrypted_value')
              .eq('user_id', userId)
              .eq('setting_key', 'META_ACCESS_TOKEN')
              .single()

            if (settingsError || !settings) {
              throw new Error(`Token não encontrado no banco para o usuário ${userId}`)
            }

            const accessToken = decrypt(settings.encrypted_value, encryptionKey);
            if (!accessToken) {
              throw new Error(`Falha ao descriptografar token para o usuário ${userId}. Verifique a ENCRYPTION_KEY.`);
            }
            
            const leadRes = await fetch(`https://graph.facebook.com/v22.0/${leadgenId}?fields=field_data,created_time,campaign_name&access_token=${accessToken}`)
            const leadData = await leadRes.json()

            if (leadData.error) {
              throw new Error(`Erro Meta API: ${leadData.error.message}`)
            }

            const fieldData = leadData.field_data || []
            const getField = (name: string) => fieldData.find(f => f.name === name)?.values[0] || null

            const newLead = {
              user_id: userId,
              email: getField('email'),
              nome: getField('full_name') || `${getField('first_name') || ''} ${getField('last_name') || ''}`.trim(),
              telefone: getField('phone_number'),
              campanha_nome: leadData.campaign_name || 'Sem Campanha', // Crucial para o Dashboard
              canal: 'Facebook Ads',
              situacao_atendimento: 'Novo',
              fac_id: leadgenId,
              cadastro: createdTime ? new Date(createdTime * 1000).toISOString() : new Date().toISOString(),
              atualizacao: new Date().toISOString(),
            }

            console.log("3. Salvando no Banco:", newLead.email);
            const { error: dbError } = await supabaseAdmin
              .from('crm_leads')
              .upsert(newLead, { onConflict: 'user_id,email' })

            if (dbError) throw dbError;
            console.log("4. Sucesso! Lead no CRM.");
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error("ERRO CRÍTICO:", errorMessage);
      // Retornamos 200 mesmo em erro de lógica para evitar que a Meta 
      // tente reenviar o mesmo erro repetidamente (Flood)
      return new Response(JSON.stringify({ error: errorMessage }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
})
