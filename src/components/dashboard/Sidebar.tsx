import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Target, 
  Settings, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Menu,
  Users
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Estado para controlar se está expandido ou colapsado
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Em mobile, a sidebar geralmente é um drawer, então esse componente pode nem renderizar ou se comportar diferente.
  // Mas para tablet/desktop, vamos controlar o estado inicial.
  
  // Efeito para começar colapsado em telas menores que desktop large se quiser, 
  // ou manter padrão fechado para clean look.
  
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao sair",
        description: error.message,
      });
    }
  };

  const isActive = (path: string) => location.pathname === path;

  // Lógica de visualização: Expandido se (travado aberto OU mouse em cima) E não for mobile
  const showFull = (isExpanded || isHovered) && !isMobile;

  if (isMobile) return null; // Mobile usa o MobileHeader normalmente

  return (
    <div 
      className={cn(
        "flex flex-col h-screen border-r border-slate-800 bg-[#0f172a] transition-all duration-300 z-50",
        showFull ? "w-64" : "w-20"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header da Sidebar */}
      <div className="h-20 flex items-center px-4 border-b border-slate-800 relative">
        <div className="flex items-center gap-3 w-full overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#f90f54] to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#f90f54]/20">
             {/* Logo Icon */}
             <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
             </svg>
          </div>
          
          <div className={cn(
            "flex flex-col transition-opacity duration-300",
            showFull ? "opacity-100" : "opacity-0 w-0"
          )}>
            <span className="font-bold text-white text-lg tracking-tight whitespace-nowrap">Real ROI Hub</span>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest">Intelligence</span>
          </div>
        </div>

        {/* Botão de Travar/Destravar (Pin) */}
        {showFull && (
            <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white h-6 w-6"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {isExpanded ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 py-6 px-3 space-y-2 overflow-x-hidden">
        <NavItem 
            to="/dashboard" 
            icon={LayoutDashboard} 
            label="Dashboard" 
            isActive={isActive("/dashboard")} 
            showLabel={showFull} 
        />
        <NavItem 
            to="/crm" 
            icon={Users} 
            label="CRM Leads" 
            isActive={isActive("/crm")} 
            showLabel={showFull} 
        />
        <NavItem 
            to="/settings" 
            icon={Settings} 
            label="Configurações" 
            isActive={isActive("/settings")} 
            showLabel={showFull} 
        />
      </nav>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 group text-slate-400 hover:text-red-400 hover:bg-red-500/10",
            !showFull && "justify-center"
          )}
          title="Sair"
        >
          <LogOut className="w-5 h-5 flex-shrink-0 transition-transform group-hover:-translate-x-1" />
          <span className={cn(
              "font-medium transition-all duration-300 overflow-hidden whitespace-nowrap",
              showFull ? "w-auto opacity-100" : "w-0 opacity-0"
          )}>
            Sair do Sistema
          </span>
        </button>
      </div>
    </div>
  );
};

// Componente auxiliar para Item de Menu
const NavItem = ({ to, icon: Icon, label, isActive, showLabel }: any) => (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group relative",
        isActive 
          ? "bg-[#f90f54] text-white shadow-lg shadow-[#f90f54]/25" 
          : "text-slate-400 hover:text-white hover:bg-slate-800",
        !showLabel && "justify-center"
      )}
      title={!showLabel ? label : undefined}
    >
      <Icon className={cn(
          "w-5 h-5 flex-shrink-0 transition-colors",
          isActive ? "text-white" : "group-hover:text-white"
      )} />
      
      <span className={cn(
          "font-medium transition-all duration-300 overflow-hidden whitespace-nowrap",
          showLabel ? "w-auto opacity-100" : "w-0 opacity-0"
      )}>
        {label}
      </span>

      {/* Indicador Ativo (Ponto) quando colapsado */}
      {!showLabel && isActive && (
          <div className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
      )}
    </Link>
);

export default Sidebar;