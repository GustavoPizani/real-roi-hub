import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import CryptoJS from "https://esm.sh/crypto-js@4.2.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const decrypt = (ciphertext: string, key: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted;
  } catch (e) {
    console.error("[ERRO] Falha na descriptografia:", e.message);
    return "";
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const webhookVerifyToken = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN')
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY')

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === webhookVerifyToken) {
      return new Response(challenge, { status: 200, headers: corsHeaders })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method === 'POST') {
    try {
      const payload = await req.json()
      console.log('1. Payload recebido:', JSON.stringify(payload))

      const userId = url.searchParams.get('user_id')
      if (!userId) throw new Error('user_id ausente na URL')

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )

      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field === 'leadgen') {
            const leadgenId = change.value.leadgen_id
            console.log('2. Processando Leadgen ID:', leadgenId)
            
            // Busca o token do usuário
            const { data: settings } = await supabaseAdmin
              .from('api_settings')
              .select('encrypted_value')
              .eq('user_id', userId)
              .eq('setting_key', 'META_ACCESS_TOKEN')
              .single()

            if (!settings) throw new Error('Token não encontrado no banco')

            const accessToken = decrypt(settings.encrypted_value, encryptionKey!)
            if (!accessToken) throw new Error('Falha ao descriptografar token')
            
            // Busca dados reais na Meta
            console.log('3. Buscando detalhes na Graph API...')
            const leadRes = await fetch(`https://graph.facebook.com/v18.0/${leadgenId}?access_token=${accessToken}`)
            const leadData = await leadRes.json()

            if (leadData.error) throw new Error(`Erro Meta API: ${leadData.error.message}`)

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
              cadastro: new Date().toISOString(),
            }

            console.log('4. Tentando salvar no CRM:', newLead.email)

            const { error: dbError } = await supabaseAdmin
              .from('crm_leads')
              .upsert(newLead, { onConflict: 'user_id,email' })

            if (dbError) throw dbError
            console.log('5. Sucesso! Lead salvo.')
          }
        }
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    } catch (error) {
      console.error('ERRO CRÍTICO:', error.message)
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }
  }
  return new Response('Method Not Allowed', { status: 405 })
})