import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  // 1. Lidar com CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Pegue o corpo da requisição com segurança
    const { message, input } = await req.json();

    const textToSent = message || input || "Olá"; // Garante que a variável que vai para o Google não esteja vazia
    
    // 2. Chave de Teste (Como você inseriu manualmente)
    const geminiKey = "AIzaSyD9G2DllkEL7G3usEDAHDxd9cKpfWAjVKk"

    // Use o identificador estável mais recente da sua lista
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`;

    console.log("Enviando para o Google...");
    
    // 2. Chame a API com a estrutura exata que o Google exige
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: textToSent }]
        }]
      })
    })

    // 2. Log de depuração para ver o status real
    console.log("Status da Resposta Google:", response.status);

    const data = await response.json()

    if (data.error) {
      console.error("Erro Google API:", data.error.message)
      return new Response(JSON.stringify({ error: data.error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!data.candidates || data.candidates.length === 0) {
      console.error("Nenhuma resposta da IA:", data);
      return new Response(JSON.stringify({ error: "A IA não gerou uma resposta válida." }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // O Google Gemini 1.5/Flash-Latest retorna neste formato:
    const aiResponse = data.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
