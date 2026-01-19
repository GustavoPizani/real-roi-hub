import { BarChart3, Settings, Upload, LogOut, Home } from "lucide-react";
import { Button } from "@/components/ui/button"; // Importe Users ou Database aqui
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface SidebarProps {
  onNavigate: (page: string) => void;
  currentPage: string;
}

const Sidebar = ({ onNavigate, currentPage }: SidebarProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Erro ao sair", variant: "destructive" });
    } else {
      navigate("/auth");
    }
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "crm", label: "CRM & Leads", icon: Users }, // Novo item de navegação
    { id: "settings", label: "Configurações", icon: Settings },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-[#1a1f2c] border-r border-slate-800 flex flex-col shadow-[4px_0_24px_rgba(249,15,84,0.05)]">
      {/* Logo com Nome Atualizado e Neon Rosa */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f90f54]/10 border border-[#f90f54]/30 flex items-center justify-center shadow-[0_0_15px_rgba(249,15,84,0.2)]">
            <BarChart3 className="w-5 h-5 text-[#f90f54]" />
          </div>
          <div>
            <h1 className="font-black text-sm tracking-tighter text-white">REAL <span className="text-[#f90f54]">ROI HUB</span></h1>
            <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Intelligence</p>
          </div>
        </div>
      </div>

      {/* Navegação Principal */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 h-11 text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-300 rounded-xl",
              currentPage === item.id && "bg-[#f90f54]/10 text-[#f90f54] border border-[#f90f54]/20 shadow-[0_0_20px_rgba(249,15,84,0.1)]"
            )}
            onClick={() => onNavigate(item.id)}
          >
            <item.icon className={cn("w-5 h-5", currentPage === item.id ? "text-[#f90f54]" : "text-slate-500")} />
            <span className="font-bold text-xs uppercase tracking-wider">{item.label}</span>
          </Button>
        ))}
      </nav>

      {/* Botão de Sair */}
      <div className="p-4 border-t border-slate-800">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-11 text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all rounded-xl"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5" />
          <span className="font-bold text-xs uppercase tracking-wider">Sair</span>
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;