import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Settings, LogOut, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

const menuItems = [
  { icon: LayoutDashboard, label: "Visão Geral", path: "/" },
  { icon: Users, label: "CRM & Leads", path: "/crm" },
  { icon: Settings, label: "Configurações", path: "/settings" },
];

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error) {
      toast({
        title: "Erro ao sair",
        description: "Ocorreu um erro ao tentar sair da aplicação.",
        variant: "destructive",
      });
    }
  };

  return (
    <aside className="hidden h-screen w-64 flex-col border-r border-slate-800 bg-[#1a1f2c] shadow-[4px_0_24px_rgba(249,15,84,0.05)] md:flex">
      <div className="flex h-16 items-center border-b border-slate-800 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#f90f54]/30 bg-[#f90f54]/10 shadow-[0_0_15px_rgba(249,15,84,0.2)]">
            <BarChart3 className="h-5 w-5 text-[#f90f54]" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tighter text-white">REAL <span className="text-[#f90f54]">ROI HUB</span></h1>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Intelligence</p>
          </div>
        </div>
      </div>
      
      <nav className="flex flex-1 flex-col gap-y-2 p-4">
        {menuItems.map((item) => (
          <Link key={item.path} to={item.path}>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 h-11 rounded-xl px-4 transition-all duration-300",
                isActive(item.path) 
                  ? "bg-[#f90f54]/10 text-[#f90f54] border border-[#f90f54]/20 shadow-[0_0_20px_rgba(249,15,84,0.1)]" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive(item.path) ? "text-[#f90f54]" : "text-slate-500")} />
              <span className="font-bold text-xs uppercase tracking-wider">{item.label}</span>
            </Button>
          </Link>
        ))}
      </nav>

      <div className="mt-auto p-4 border-t border-slate-800">
        <div className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 border border-green-500/20">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs font-medium text-green-500">API Conectada</span>
          </div>
        </div>

        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-11 text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all rounded-xl"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          <span className="font-bold text-xs uppercase tracking-wider">Sair</span>
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;