import { useState, useEffect } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import CRMUpload from "@/components/crm/CRMUpload";
import LeadsTable from "@/components/crm/LeadsTable";
import { supabase } from "@/integrations/supabase/client";
import { Filter, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

const CRMLeadsPage = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [filterCampaign, setFilterCampaign] = useState("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        // Busca campanhas para o seletor da tabela
        supabase.from("campaign_metrics")
          .select("campaign_name")
          .eq("user_id", user.id)
          .then(({ data }) => {
            if (data) {
              const unique = Array.from(new Set(data.map(d => d.campaign_name))).map(name => ({ campaignName: name }));
              setCampaigns(unique);
            }
          });
      }
    });
  }, []);

  if (!userId) return null;

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-200">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Gestão de Leads (CRM)</h1>
          <p className="text-slate-400 text-sm">Auditoria e sincronização de dados de vendas.</p>
        </div>

        {/* Componente de Importação */}
        <CRMUpload 
          userId={userId} 
          onUploadComplete={() => setRefreshTrigger(prev => prev + 1)} 
        />

        {/* Filtro de Auditoria */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <Filter className="w-4 h-4" /> AUDITORIA DE DATA:
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="gap-2 border-slate-700 text-white text-[10px] uppercase tracking-widest hover:bg-[#f90f54]"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortOrder === "desc" ? "Mais Recentes (Upload Novo)" : "Mais Antigos (Verificar Gap)"}
          </Button>
        </div>

        {/* Tabela */}
        <LeadsTable 
          userId={userId}
          refreshTrigger={refreshTrigger}
          filterCampaign={filterCampaign}
          setFilterCampaign={setFilterCampaign}
          sortOrder={sortOrder}
          campaigns={campaigns}
        />
      </main>
    </div>
  );
};

export default CRMLeadsPage; // IMPORTANTE: Exportação default para evitar erro no Vite