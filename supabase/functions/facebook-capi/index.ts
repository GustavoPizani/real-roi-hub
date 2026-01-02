import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Função de Mapeamento baseada na sua planilha
const mapStatusToMeta = (statusCrm: string): string => {
  if (!statusCrm) return "Lead";
  const s = statusCrm.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  if (s.includes("venda")) return "Purchase";
  if (s.includes("proposta") || s.includes("negociacao")) return "SubmitApplication";
  if (s.includes("visita") || s.includes("apresentando")) return "Schedule";
  if (s.includes("atendimento") || s.includes("contato")) return "Contact";
  
  return "Lead"; // Status padrão caso não encontre correspondência
};

async function hashData(data: string): Promise<string> {
  if (!data) return "";
  const encoder = new TextEncoder();
  const rawData = encoder.encode(data.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", rawData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  // SCAN INICIAL: Monitora se a função foi acordada
  console.log("--- INICIANDO PROCESSAMENTO CAPI ---");
  
  try {
    const { record } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // PROTEÇÃO: Se o user_id vier vazio do lead, usamos o seu ID fixo para o teste
    const userIdParaBusca = record.user_id || '386afc54-a97a-4375-8abb-210ed97d6de1';

    console.log("Iniciando busca para o User ID:", userIdParaBusca);

    // BUSCA CONFIGURAÇÕES NA TABELA api_settings COM O NOME CORRETO DA COLUNA
    const { data: settings, error: settingsError } = await supabase
      .from('api_settings')
      .select('setting_key, encrypted_value')
      .eq('user_id', userIdParaBusca);

    if (settingsError) {
      console.error("FALHA NO BANCO:", settingsError.message);
      throw settingsError;
    }

    // SCAN FLEXÍVEL: Tenta achar por diferentes nomes possíveis
    const findSetting = (keyNames: string[]) => 
      settings?.find(s => keyNames.includes(s.setting_key))?.encrypted_value?.trim();

    const pixelId = findSetting(['meta_pixel_id', 'Meta Pixel ID', 'pixel_id']);
    const accessToken = findSetting(['meta_access_token', 'Meta Access Token', 'access_token']);

    console.log("Pixel encontrado:", pixelId ? "SIM" : "NÃO");
    console.log("Token encontrado:", accessToken ? "SIM" : "NÃO");

    if (!pixelId || !accessToken) {
      throw new Error("Credenciais Meta não encontradas para este usuário.");
    }

    console.log("Enviando para o Pixel ID:", pixelId);

    // 2. Captura e Mapeia o status da coluna 'situacao_atendimento'
    const crmStatus = record.situacao_atendimento;
    const metaEventName = mapStatusToMeta(crmStatus);

    console.log(`Mapeando status CRM: "${crmStatus}" para Meta: "${metaEventName}"`);

    // ENVIO PARA META (Com o TEST48935 ativo para o seu teste)
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [{
            event_name: metaEventName, // AGORA NUNCA VAI VAZIO
            event_time: Math.floor(Date.now() / 1000),
            action_source: "website",
            user_data: {
              em: [await hashData(record.email || "")]
            },
            custom_data: { currency: "BRL", value: metaEventName === "Purchase" ? "500.00" : "0.00" }
          }],
        }),
      }
    );

    const result = await response.json();
    
    // SCAN DE RESPOSTA: Captura erros de Token (como o 190) ou Sucesso
    console.log("RESPOSTA DA META:", JSON.stringify(result));

    return new Response(JSON.stringify(result), { status: 200 });

  } catch (err: unknown) {
    // SCAN DE ERRO CRÍTICO: Captura falhas de código ou rede
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error("ERRO DURANTE EXECUÇÃO:", errorMessage);
    return new Response(errorMessage, { status: 500 });
  }
});