import { Home, Upload, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface BottomNavProps {
  onNavigate: (page: string) => void;
  currentPage: string;
}

const BottomNav = ({ onNavigate, currentPage }: BottomNavProps) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "crm", label: "CRM", icon: Upload },
    { id: "settings", label: "Config", icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1f2c]/95 backdrop-blur-xl border-t border-slate-800 safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              "flex flex-col items-center justify-center min-w-[64px] min-h-[44px] py-2 px-3 rounded-xl transition-all active:scale-95",
              currentPage === item.id
                ? "text-[#f90f54]"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <item.icon className={cn(
              "w-6 h-6 mb-1",
              currentPage === item.id && "drop-shadow-[0_0_8px_rgba(249,15,84,0.5)]"
            )} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
          </button>
        ))}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center min-w-[64px] min-h-[44px] py-2 px-3 rounded-xl text-slate-500 hover:text-red-400 transition-all active:scale-95"
        >
          <LogOut className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Sair</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
