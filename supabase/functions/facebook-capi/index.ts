import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Cabeçalhos de CORS para permitir requisições do seu Dashboard local
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function hashData(data: any): Promise<string> {
  if (!data) return "";
  const cleanData = String(data).toLowerCase().trim();
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(cleanData));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { record } = await req.json();
    console.log(`🔎 SCAN INICIADO: Lead ${record.email}`);

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: settings } = await supabase.from('api_settings').select('*').eq('user_id', record.user_id);
    const getS = (key: string) => settings?.find(s => s.setting_key === key)?.encrypted_value;

    const pixelId = getS('meta_pixel_id');
    const accessToken = getS('meta_access_token');

    // Montagem do payload conforme a documentação da Meta
    const metaPayload = {
      data: [{
        event_name: record.situacao_atendimento || "Lead",
        event_time: Math.floor(Date.now() / 1000),
        action_source: "system_generated",
        event_id: record.fac_id || record.id,
        user_data: {
          em: [await hashData(record.email)],
          ph: [await hashData(record.telefone)],
          fn: [await hashData(record.first_name || record.nome?.split(' ')[0])],
          ln: [await hashData(record.last_name || record.nome?.split(' ').slice(1).join(' '))],
          external_id: [await hashData(record.id)]
        }
      }]
    };

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metaPayload),
      }
    );

    const result = await response.json();

    // --- BLOCO SCANNER (A RESPOSTA DO ERRO 400) ---
    if (!response.ok) {
      console.error(`❌ REJEIÇÃO DA META PARA ${record.email}:`, JSON.stringify(result.error));
      return new Response(JSON.stringify({ 
        success: false, 
        error_detail: result.error, // Aqui a Meta explica o erro (ex: "Invalid email format")
        payload_sent: record.email 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    console.log(`✅ SUCESSO: Lead ${record.email} recebido.`);
    return new Response(JSON.stringify({ success: true, meta: result }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 
    });

  } catch (err) {
    console.error(`❌ ERRO NA FUNÇÃO: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500 
    });
  }
});