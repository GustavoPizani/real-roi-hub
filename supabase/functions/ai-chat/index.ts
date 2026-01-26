import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// SEU PROMPT COMPLETO E DETALHADO
const ANALYST_PERSONA = `
Atue como um Analista de Decisão de Marketing e Cientista de Dados Sênior. Sua função não é apenas apresentar números, mas interpretar os dados das campanhas deste dashboard para fornecer insights de causalidade (não apenas correlação) e recomendações práticas de negócios.

Ao analisar os dados disponíveis no dashboard e as informações que eu fornecer, siga estritamente estas diretrizes:

1. ANÁLISE E DIAGNÓSTICO:
   - Identifique a história por trás dos números. Onde está o gargalo real? (Ex: tráfego alto mas baixa conversão indica problema de qualidade ou oferta, não apenas falta de budget).
   - Ignore métricas de vaidade. Foque em métricas de negócio (ROAS, CPA, Lucro, Taxa de Conversão Real).
   - Para Testes A/B, avalie a confiança estatística e o risco de falso positivo antes de declarar um vencedor.

2. RECOMENDAÇÕES DE AÇÃO ("PRÓXIMOS PASSOS"):
   - Para cada análise, forneça 3 ações claras: O que devemos parar? O que devemos iterar? O que devemos escalar?
   - Ao sugerir alocação de verba (Budget Shift), justifique a lógica estratégica (ex: "Escalar canal X pois o CPA é saudável e há espaço; Reduzir canal Y pois está saturado").

3. INTERATIVIDADE E COLABORAÇÃO:
   - Este é um ambiente colaborativo. Eu enviarei sugestões, hipóteses ou ideias de campanhas.
   - Quando eu sugerir uma ideia, não apenas concorde. Avalie a viabilidade dessa ideia com base nos dados históricos atuais. Se minha ideia contradizer os dados, alerte-me educadamente e mostre a evidência.
   - Se os dados estiverem incompletos ou fragmentados, faça a melhor recomendação possível com o que temos, mas aponte as lacunas.

4. COMUNICAÇÃO:
   - Use linguagem simples e direta, adequada para um Diretor de Marketing ou CEO. Evite jargões técnicos desnecessários ou fórmulas complexas.
   - Seja conciso. Vá direto ao ponto: Problema Principal > Oportunidade > Ação Recomendada.
`;

serve(async (req) => {
  // Lidar com CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { apiKey, data, messages, mode } = await req.json();

    if (!apiKey) {
      throw new Error("Chave API não fornecida.");
    }

    let groqBody;

    // --- MODO 1: ANÁLISE AUTOMÁTICA DE DASHBOARD (Painel de Insights) ---
    // A IA recebe os dados e deve retornar APENAS um JSON para renderizar os cards.
    if (mode === 'analysis' || (!messages && data)) {
        
        // Preparar resumo dos dados (Top 20 campanhas para dar contexto amplo)
        const dataSummary = data ? data.slice(0, 20).map((c: any) => ({
            campanha: c.campaign_name,
            investimento: `R$ ${c.spend}`,
            leads: c.leads,
            cpl: `R$ ${c.cpl ? c.cpl.toFixed(2) : 0}`,
            ctr: `${c.ctr ? c.ctr.toFixed(2) : 0}%`,
            cliques: c.clicks
        })) : [];

        if (dataSummary.length === 0) {
             return new Response(JSON.stringify([{ type: "info", text: "Aguardando dados para iniciar a análise de cientista de dados." }]), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        groqBody = {
            model: "llama-3.3-70b-versatile",
            messages: [
                { 
                    role: "system", 
                    content: `${ANALYST_PERSONA}
                    
                    INSTRUÇÃO TÉCNICA OBRIGATÓRIA PARA ESTE MODO:
                    Seu output deve ser ESTRITAMENTE um array JSON puro (sem markdown, sem explicações antes ou depois).
                    Analise os dados fornecidos e gere de 3 a 5 insights seguindo o formato abaixo:
                    [
                      { "type": "warning" | "success" | "danger" | "info", "text": "Seu diagnóstico curto e ação recomendada aqui." }
                    ]` 
                },
                { 
                    role: "user", 
                    content: `DADOS DO DASHBOARD PARA ANÁLISE: ${JSON.stringify(dataSummary)}` 
                }
            ],
            temperature: 0.4, // Mais preciso/conservador para a análise estática
            response_format: { type: "json_object" } // Tenta forçar JSON nativo
        };
    } 
    
    // --- MODO 2: CHAT INTERATIVO (Botão "IA Analista") ---
    // Aqui a IA conversa livremente com você, mantendo a persona de Cientista de Dados.
    else if (messages) {
        groqBody = {
            model: "llama-3.3-70b-versatile",
            messages: [
                { 
                    role: "system", 
                    content: `${ANALYST_PERSONA}
                    
                    CONTEXTO: Você está em um chat direto com o usuário. Responda às perguntas dele usando os dados fornecidos no contexto (se houver).
                    Use formatação Markdown (negrito, listas) para facilitar a leitura.` 
                },
                ...messages // Histórico da conversa + Contexto dos dados injetado pelo Front
            ],
            temperature: 0.7, // Um pouco mais criativo e conversacional
            max_tokens: 1500
        };
    } else {
        throw new Error("Payload inválido. Envie 'data' para análise ou 'messages' para chat.");
    }

    // Chamada à API da Groq
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(groqBody)
    });

    const result = await response.json();

    if (result.error) {
      console.error("Groq API Error:", result.error);
      throw new Error(result.error.message || "Erro desconhecido na Groq API");
    }

    const aiText = result.choices?.[0]?.message?.content || "";
    
    // Processamento da resposta
    let finalResponse;
    if (mode === 'analysis' || (!messages && data)) {
        // Se for análise, limpa qualquer markdown para garantir que o JSON parse do front funcione
        const cleanJson = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
        finalResponse = cleanJson;
    } else {
        // Se for chat, manda o texto puro (com markdown)
        finalResponse = aiText;
    }

    return new Response(JSON.stringify(finalResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error("Erro Edge Function:", error.message);
    // Retorna erro 500 com JSON explicativo
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
})