import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIChatPanelProps {
  onClose?: () => void;
  user?: any;
  dashboardContext?: string;
}

export const AIChatPanel = ({ onClose, user, dashboardContext }: AIChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Olá! Sou sua IA especialista em ROI. Analiso seus dados do Meta e CRM. Como posso ajudar a otimizar suas campanhas hoje?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // Recupera o contexto se não foi passado via props (fallback)
      let contextData = dashboardContext;
      if (!contextData) {
         // Tenta pegar dados básicos se não houver contexto rico
         contextData = "Usuário perguntando sobre dados gerais.";
      }

      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { 
          message: userMessage,
          context: contextData,
          userId: user?.id 
        },
      });

      if (error) throw error;

      if (data?.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch (error) {
      console.error("Erro no chat:", error);
      toast({
        title: "Erro na IA",
        description: "Não foi possível processar sua mensagem.",
        variant: "destructive",
      });
      setMessages((prev) => [...prev, { role: "assistant", content: "Desculpe, tive um erro técnico ao processar sua solicitação. Tente novamente." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="h-full border-none shadow-none flex flex-col bg-background">
      <CardHeader className="p-4 border-b flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">Assistente ROI</CardTitle>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div
                  className={`rounded-lg p-3 max-w-[80%] text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="p-4 border-t mt-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre seus leads ou custos..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};