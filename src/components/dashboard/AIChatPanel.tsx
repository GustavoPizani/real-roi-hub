import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import CryptoJS from "crypto-js";
import { useDashboardData } from "@/hooks/useDashboardData";

const ENCRYPTION_KEY = "ads-intel-hub-2024";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export const AIChatPanel = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Olá! Sou seu Analista de Dados Sênior. Estou analisando suas campanhas em tempo real. Como posso ajudar a otimizar seu ROI hoje?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Mudança: Ref aponta para o final da lista, não para a viewport
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { data: campaignData } = useDashboardData(); 

  // Auto-scroll: Rola para o final sempre que mensagens mudam
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user" as const, content: input };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não logado");

      const { data: settings } = await supabase
        .from("api_settings")
        .select("encrypted_value")
        .eq("user_id", user.id)
        .eq("setting_key", "GEMINI_API_KEY")
        .single();

      if (!settings) throw new Error("Configure sua chave em /settings");

      const bytes = CryptoJS.AES.decrypt(settings.encrypted_value, ENCRYPTION_KEY);
      const apiKey = bytes.toString(CryptoJS.enc.Utf8);

      let apiMessages = newMessages.filter(m => m.role !== 'system');
      
      if (campaignData && campaignData.length > 0) {
         const context = `CONTEXTO ATUAL DO DASHBOARD (Resumo): 
         Top Campanhas: ${campaignData.slice(0,5).map(c => `${c.campaign_name} (CPL: R$${c.cpl?.toFixed(2)})`).join(', ')}.`;
         
         apiMessages = [
             { role: "system", content: context },
             ...apiMessages
         ];
      }

      const { data: responseText, error } = await supabase.functions.invoke('ai-chat', {
        body: { 
            apiKey, 
            messages: apiMessages,
            mode: 'chat'
        }
      });

      if (error) throw error;

      const cleanText = typeof responseText === 'string' ? responseText.replace(/^"|"$/g, '').replace(/\\n/g, '\n') : String(responseText);

      setMessages(prev => [...prev, { role: "assistant", content: cleanText }]);

    } catch (error: any) {
      console.error("Erro Chat:", error);
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Erro: " + (error.message || "Falha na conexão.") }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0f172a] border-l border-slate-800">
      {/* ScrollArea sem a prop viewportRef que causava erro */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-[#f90f54] text-white rounded-br-none' 
                    : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1 opacity-50 text-[10px] uppercase font-bold tracking-wider">
                    {m.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                    {m.role === 'user' ? 'Você' : 'ROI Analyst'}
                </div>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 rounded-2xl p-4 rounded-bl-none border border-slate-700 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-[#f90f54] animate-spin" />
                <span className="text-xs text-slate-400">Digitando...</span>
              </div>
            </div>
          )}

          {/* Elemento invisível para forçar o scroll para baixo */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-slate-800 bg-[#0f172a]">
        <div className="flex gap-2">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Pergunte sobre suas campanhas..."
            className="bg-slate-900 border-slate-700 text-white focus:border-[#f90f54]"
            disabled={isLoading}
          />
          <Button 
            onClick={handleSend} 
            disabled={isLoading}
            size="icon"
            className="bg-[#f90f54] hover:bg-[#d60040] text-white"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <div className="flex justify-center mt-2">
            <button 
                onClick={() => setMessages([messages[0]])}
                className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
            >
                <Eraser className="w-3 h-3" /> Limpar conversa
            </button>
        </div>
      </div>
    </div>
  );
};