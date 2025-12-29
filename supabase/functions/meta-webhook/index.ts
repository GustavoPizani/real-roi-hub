import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import CryptoJS from "https://esm.sh/crypto-js@4.2.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FieldDataItem {
  name: string;
  values: string[];
}

const decrypt = (ciphertext: string, key: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    console.error("[ERRO] Falha na descriptografia:", errorMessage);
    return "";
  }
};

Deno.serve(async (req) => {
  console.log('[WEBHOOK] Requisição recebida:', req.method);
  
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const webhookVerifyToken = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN')
  const encryptionKey = Deno.env.get('ENCRYPTION_KEY')

  // GET - Verificação do Webhook pela Meta
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    console.log('[WEBHOOK] Verificação - mode:', mode, 'token:', token);

    if (mode === 'subscribe' && token === webhookVerifyToken) {
      console.log('[WEBHOOK] Verificação OK, retornando challenge');
      return new Response(challenge, { status: 200, headers: corsHeaders })
    }
    console.log('[WEBHOOK] Verificação FALHOU');
    return new Response('Forbidden', { status: 403 })
  }

  // POST - Recebimento de Leads
  if (req.method === 'POST') {
    try {
      // PROTEÇÃO: Lê como texto primeiro para evitar erro "Unexpected end of JSON"
      const bodyText = await req.text();
      if (!bodyText) {
        console.error('[WEBHOOK] Erro: Corpo da requisição vazio');
        return new Response('Empty body', { status: 400 });
      }

      const payload = JSON.parse(bodyText);
      console.log('[WEBHOOK] 1. Payload recebido:', JSON.stringify(payload, null, 2))

      const userId = url.searchParams.get('user_id')
      if (!userId) {
        console.error('[WEBHOOK] ERRO: user_id ausente na URL');
        throw new Error('user_id ausente na URL')
      }
      console.log('[WEBHOOK] 2. user_id:', userId);

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )

      // Itera sobre as entradas enviadas pela Meta
      if (payload.entry) {
        for (const entry of payload.entry) {
          if (!entry.changes) continue;
          
          for (const change of entry.changes) {
            if (change.field === 'leadgen') {
              const leadgenId = change.value.leadgen_id
              const createdTime = change.value.created_time
              
              console.log('[WEBHOOK] 3. Processando Leadgen ID:', leadgenId);
              
              // Busca o token do usuário no banco
              const { data: settings, error: settingsError } = await supabaseAdmin
                .from('api_settings')
                .select('encrypted_value')
                .eq('user_id', userId)
                .eq('setting_key', 'META_ACCESS_TOKEN')
                .single()

              if (settingsError || !settings) {
                console.error('[WEBHOOK] ERRO: Token não encontrado ou erro no banco', settingsError);
                throw new Error('Token não encontrado no banco');
              }

              // Descriptografia do Token
              const accessToken = decrypt(settings.encrypted_value, encryptionKey!)
              if (!accessToken) {
                console.error('[WEBHOOK] ERRO: Falha ao descriptografar token');
                throw new Error('Falha ao descriptografar token')
              }
              
              // Busca os dados completos do Lead na Graph API da Meta
              console.log('[WEBHOOK] 4. Buscando detalhes na Meta Graph API...');
              const leadRes = await fetch(`https://graph.facebook.com/v18.0/${leadgenId}?access_token=${accessToken}`)
              const leadData = await leadRes.json()

              if (leadData.error) {
                console.error('[WEBHOOK] ERRO da Meta API:', leadData.error);
                throw new Error(`Erro Meta API: ${leadData.error.message}`)
              }

              // Mapeamento dos campos do formulário
              const fieldData: FieldDataItem[] = leadData.field_data || []
              const getField = (name: string): string | null => 
                fieldData.find((f: FieldDataItem) => f.name === name)?.values[0] || null

              const fullName = getField('full_name');
              const firstName = getField('first_name') || '';
              const lastName = getField('last_name') || '';
              const nome = fullName || `${firstName} ${lastName}`.trim() || 'Sem Nome';

              const newLead = {
                user_id: userId,
                email: getField('email'),
                nome: nome,
                telefone: getField('phone_number'),
                canal: 'Facebook Ads',
                situacao_atendimento: 'Novo',
                fac_id: leadgenId,
                cadastro: createdTime ? new Date(createdTime * 1000).toISOString() : new Date().toISOString(),
                atualizacao: new Date().toISOString()
              }

              console.log('[WEBHOOK] 5. Tentando salvar no CRM:', newLead.email);

              const { error: dbError } = await supabaseAdmin
                .from('crm_leads')
                .upsert(newLead, { onConflict: 'user_id,email' })

              if (dbError) {
                console.error('[WEBHOOK] ERRO ao salvar no banco:', dbError);
                throw dbError
              }
              console.log('[WEBHOOK] 6. Sucesso! Lead salvo no CRM.');
            }
          }
        }
      }
      
      return new Response(JSON.stringify({ success: true }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[WEBHOOK] FALHA NO PROCESSAMENTO:', errorMessage);
      
      // Retornamos 200 mesmo em erro de lógica para evitar que a Meta 
      // tente reenviar o mesmo erro repetidamente (Flood)
      return new Response(JSON.stringify({ error: errorMessage }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }
  }
  
  return new Response('Method Not Allowed', { status: 405 })
})