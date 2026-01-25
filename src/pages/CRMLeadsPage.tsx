import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UploadCloud } from "lucide-react";

import Sidebar from "@/components/dashboard/Sidebar";
import BottomNav from "@/components/dashboard/BottomNav";
import CRMUpload from "@/components/crm/CRMUpload";
import LeadsTable from "@/components/crm/LeadsTable";
import { useIsMobile } from "@/hooks/use-mobile";

const CRMLeadsPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [user, setUser] = useState<any>(null);
  const [crmRefresh, setCrmRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  // currentPage is now derived internally by Sidebar and BottomNav
  // The CRMLeadsPage itself doesn't need a currentPage state for its own rendering logic
  // as it always renders CRMUpload and LeadsTable.

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0f172a]">
        <Loader2 className="h-8 w-8 animate-spin text-[#f90f54]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f172a] text-slate-200">
      {!isMobile && (
        <Sidebar />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="h-20 flex-shrink-0 flex items-center justify-between px-4 md:px-8 border-b border-slate-800/50 bg-[#0f172a]/80 backdrop-blur-xl z-20">
          <div className="flex items-center gap-3">
            <UploadCloud className="w-6 h-6 text-[#f90f54]" />
            <h1 className="text-xl font-bold tracking-tight text-white">Gestão de Leads e CRM</h1>
          </div>
        </header>

        <main className={`flex-1 overflow-y-auto bg-[#0f172a] p-4 md:p-8`}>
          <div className="max-w-[1600px] mx-auto space-y-6 md:space-y-8">
            <CRMUpload 
              userId={user.id} 
              onUploadComplete={() => setCrmRefresh(p => p + 1)} 
              campaigns={[]}
            />
            <LeadsTable 
              userId={user.id} 
              refreshTrigger={crmRefresh} 
              campaigns={[]}
            />
          </div>
        </main>
      </div>

      {isMobile && (
        <BottomNav onNavigate={() => {}} />
      )}
    </div>
  );
};

export default CRMLeadsPage;