import { BarChart3, Settings, Upload, MessageSquare, LogOut, Home, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface SidebarProps {
  onNavigate: (page: string) => void;
  currentPage: string;
}

const Sidebar = ({ onNavigate, currentPage }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "crm", label: "CRM", icon: Upload },
    { id: "settings", label: "Configurações", icon: Settings },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-surface-1 border-r border-border flex flex-col sidebar-glow">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg gradient-text">ADS Intel</h1>
            <p className="text-xs text-muted-foreground">Intelligence Hub</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 h-11 text-muted-foreground hover:text-foreground hover:bg-muted transition-all",
              currentPage === item.id && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary neon-border"
            )}
            onClick={() => onNavigate(item.id)}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </Button>
        ))}
      </nav>

      {/* AI Chat Toggle */}
      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 h-11 text-muted-foreground hover:text-foreground hover:bg-muted transition-all",
            currentPage === "chat" && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
          )}
          onClick={() => onNavigate("chat")}
        >
          <MessageSquare className="w-5 h-5" />
          Assistente IA
        </Button>
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-11 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5" />
          Sair
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
