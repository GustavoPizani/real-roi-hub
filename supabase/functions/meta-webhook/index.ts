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
      const payload = await req.json()
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

      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field === 'leadgen') {
            const leadgenId = change.value.leadgen_id
            const formId = change.value.form_id
            const pageId = change.value.page_id
            const createdTime = change.value.created_time
            
            console.log('[WEBHOOK] 3. Processando Leadgen:', {
              leadgenId,
              formId,
              pageId,
              createdTime
            })
            
            // Busca o token do usuário
            console.log('[WEBHOOK] 4. Buscando token do usuário...');
            const { data: settings, error: settingsError } = await supabaseAdmin
              .from('api_settings')
              .select('encrypted_value')
              .eq('user_id', userId)
              .eq('setting_key', 'META_ACCESS_TOKEN')
              .single()

            if (settingsError) {
              console.error('[WEBHOOK] ERRO ao buscar settings:', settingsError);
              throw new Error('Erro ao buscar token no banco')
            }
            if (!settings) {
              console.error('[WEBHOOK] ERRO: Token não encontrado no banco');
              throw new Error('Token não encontrado no banco')
            }
            console.log('[WEBHOOK] 5. Token encontrado, descriptografando...');

            const accessToken = decrypt(settings.encrypted_value, encryptionKey!)
            if (!accessToken) {
              console.error('[WEBHOOK] ERRO: Falha ao descriptografar token');
              throw new Error('Falha ao descriptografar token')
            }
            console.log('[WEBHOOK] 6. Token descriptografado com sucesso');
            
            // Busca dados reais na Meta Graph API
            console.log('[WEBHOOK] 7. Buscando detalhes do lead na Graph API...');
            const leadRes = await fetch(`https://graph.facebook.com/v18.0/${leadgenId}?access_token=${accessToken}`)
            const leadData = await leadRes.json()
            console.log('[WEBHOOK] 8. Resposta da Graph API:', JSON.stringify(leadData, null, 2));

            if (leadData.error) {
              console.error('[WEBHOOK] ERRO da Meta API:', leadData.error);
              throw new Error(`Erro Meta API: ${leadData.error.message}`)
            }

            const fieldData: FieldDataItem[] = leadData.field_data || []
            const getField = (name: string): string | null => 
              fieldData.find((f: FieldDataItem) => f.name === name)?.values[0] || null

            // Mapeamento de nome: verifica full_name primeiro
            const fullName = getField('full_name');
            const firstName = getField('first_name') || '';
            const lastName = getField('last_name') || '';
            const nome = fullName || `${firstName} ${lastName}`.trim() || 'Sem Nome';

            // Data de cadastro: usa created_time da Meta se disponível
            const cadastroDate = createdTime 
              ? new Date(createdTime * 1000).toISOString() 
              : new Date().toISOString();

            const newLead = {
              user_id: userId,
              email: getField('email'),
              nome: nome,
              telefone: getField('phone_number'),
              canal: 'Facebook Lead Form',
              situacao_atendimento: 'Novo',
              fac_id: leadgenId,
              cadastro: cadastroDate,
            }

            console.log('[WEBHOOK] 9. Lead mapeado:', JSON.stringify(newLead, null, 2));
            console.log('[WEBHOOK] 10. Salvando no CRM...');

            const { error: dbError } = await supabaseAdmin
              .from('crm_leads')
              .upsert(newLead, { onConflict: 'user_id,email' })

            if (dbError) {
              console.error('[WEBHOOK] ERRO ao salvar no banco:', dbError);
              throw dbError
            }
            console.log('[WEBHOOK] 11. Lead salvo com sucesso!');
          }
        }
      }
      
      // Sempre retorna 200 para a Meta não reenviar
      console.log('[WEBHOOK] 12. Processamento concluído com sucesso');
      return new Response(JSON.stringify({ success: true }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[WEBHOOK] ERRO CRÍTICO:', errorMessage);
      // Retorna 200 mesmo com erro para evitar retentativas da Meta
      return new Response(JSON.stringify({ error: errorMessage, processed: false }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }
  }
  
  return new Response('Method Not Allowed', { status: 405 })
})