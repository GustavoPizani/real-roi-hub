import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import CryptoJS from "https://esm.sh/crypto-js@4.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Chave de descriptografia (deve ser a mesma do seu frontend)
const ENCRYPTION_KEY = "ads-intel-hub-2024";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context, userId } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Busca a chave criptografada no banco
    const { data: setting, error: dbError } = await supabase
      .from('api_settings')
      .select('encrypted_value')
      .eq('user_id', userId || '386afc54-a97a-4375-8abb-210ed97d6de1')
      .eq('setting_key', 'GEMINI_API_KEY')
      .single();

    if (dbError || !setting) throw new Error("GEMINI_API_KEY não encontrada.");

    // DESCRIPTOGRAFIA REAL: Transforma o 'U2Fsd...' na chave real do Gemini
    let apiKey = setting.encrypted_value;
    if (apiKey.startsWith('U2Fsd')) {
      const bytes = CryptoJS.AES.decrypt(apiKey, ENCRYPTION_KEY);
      apiKey = bytes.toString(CryptoJS.enc.Utf8);
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-1.5-flash",
        messages: [
          { role: "system", content: `Analista de tráfego imobiliário. Contexto: ${context}` },
          ...messages
        ],
      }),
    });

    if (!response.ok) {
      const errorDetail = await response.text();
      throw new Error(`AI Gateway Error (${response.status}): ${errorDetail}`);
    }

    const data = await response.json();
    return new Response(JSON.stringify({ message: data.choices[0].message.content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Erro na função:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
