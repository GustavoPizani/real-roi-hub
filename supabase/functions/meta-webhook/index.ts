
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
  } catch (e) {
    console.error("Decryption failed:", e.message);
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
      console.log("1. Request recebida. Método:", req.method);
      const body = await req.json();
      console.log("2. Payload bruto recebido:", JSON.stringify(body));

      const userId = url.searchParams.get('user_id')
      console.log("3. User ID da URL:", userId);
      if (!userId) {
        throw new Error('user_id query parameter is required in the webhook URL.')
      }

      if (!encryptionKey) {
        throw new Error('ENCRYPTION_KEY environment variable is not set.')
      }

      // Create a Supabase admin client to bypass RLS
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )

      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === 'leadgen') {
            const leadgenId = change.value.leadgen_id
            
            const { data: settings, error: settingsError } = await supabaseAdmin
              .from('api_settings')
              .select('encrypted_value')
              .eq('user_id', userId)
              .eq('setting_key', 'META_ACCESS_TOKEN')
              .single()

            if (settingsError || !settings) {
              throw new Error(`Could not find META_ACCESS_TOKEN for user ${userId}`)
            }

            const accessToken = decrypt(settings.encrypted_value, encryptionKey);
            if (!accessToken) {
              throw new Error(`Failed to decrypt access token for user ${userId}. Check ENCRYPTION_KEY.`);
            }
            
            const leadDetailsUrl = `https://graph.facebook.com/v18.0/${leadgenId}?access_token=${accessToken}`
            const leadResponse = await fetch(leadDetailsUrl)
            const leadData = await leadResponse.json()

            if (leadData.error) {
              throw new Error(`Meta API error fetching lead: ${leadData.error.message}`)
            }

            const fieldData = leadData.field_data || []
            const getField = (name: string) => fieldData.find(f => f.name === name)?.values[0] || null

            const newLead = {
              user_id: userId,
              email: getField('email'),
              nome: getField('full_name') || `${getField('first_name') || ''} ${getField('last_name') || ''}`.trim(),
              telefone: getField('phone_number'),
              canal: 'Facebook Lead Form',
              situacao_atendimento: 'Novo',
              fac_id: leadgenId,
              cadastro: new Date(leadData.created_time).toISOString(),
              atualizacao: new Date().toISOString(),
            }

            if (!newLead.email) {
              console.warn(`Skipping lead ${leadgenId} because it has no email address.`);
              continue;
            }

            console.log("4. Tentando salvar lead:", newLead.email);
            const { error: upsertError } = await supabaseAdmin
              .from('crm_leads')
              .upsert(newLead, { onConflict: 'user_id,email' })

            if (upsertError) {
              console.error("ERRO NO UPSERT:", upsertError);
            } else {
              console.log("5. Lead salvo com sucesso!");
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    } catch (error) {
      console.error('Webhook processing error:', error)
      return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
    }
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
})
