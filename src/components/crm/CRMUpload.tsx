import { useState, useRef, useEffect } from "react";
import { Upload, FileSpreadsheet, Facebook, RefreshCw, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

interface CRMUploadProps {
  userId: string;
  onUploadComplete: () => void;
}

const mapStatusToMeta = (statusCrm: string): string => {
  if (!statusCrm) return "Lead";
  const s = statusCrm.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (s.includes("venda")) return "Purchase";
  if (s.includes("proposta") || s.includes("negociacao")) return "SubmitApplication";
  if (s.includes("visita")) return "Schedule";
  if (s.includes("atendimento") || s.includes("contato")) return "Contact";
  return "Lead";
};

const normalizeLeadData = (row: any, campaignName: string, userId: string) => {
  const email = (row.email || row.Email || row['E-mail'] || "").toLowerCase().trim();
  const full_name = row.Nome || row.full_name || row.Cliente || "Sem Nome";
  const telefone = row['Seu melhor telefone'] || row.phone || row.Telefone || row.phone_number;
  
  const nameParts = full_name.trim().split(" ");
  const first_name = nameParts[0] || "";
  const last_name = nameParts.slice(1).join(" ") || "";

  let cleanPhone = telefone ? String(telefone).replace(/\D/g, '') : '';
  if (cleanPhone.length === 11 || cleanPhone.length === 10) cleanPhone = `55${cleanPhone}`;

  return {
    user_id: userId,
    email: email,
    nome: full_name,
    first_name: first_name,
    last_name: last_name,
    telefone: cleanPhone,
    cadastro: new Date(row.created_time || row.Cadastro || new Date()).toISOString(),
    campanha_nome: campaignName,
    fac_id: row.id || row.ad_id || "", 
    origem_importacao: 'facebook_csv',
    situacao_atendimento: 'Novo'
  };
};

const CRMUpload = ({ userId, onUploadComplete }: CRMUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [availableCampaigns, setAvailableCampaigns] = useState<string[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const { toast } = useToast();

  const facebookInputRef = useRef<HTMLInputElement>(null);
  const crmInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      const { data } = await supabase
        .from('campaign_metrics')
        .select('campaign_name')
        .eq('user_id', userId);
      
      if (data) {
        const unique = Array.from(new Set(data.map(d => d.campaign_name).filter(Boolean))).sort();
        setAvailableCampaigns(unique as string[]);
      }
    };
    fetchCampaigns();
  }, [userId]);

  const handleForceSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      let from = 0;
      const step = 50; 
      let hasMore = true;
      let total = 0;

      toast({ title: "Sincronização CAPI", description: "Iniciando integração com Meta..." });

      while (hasMore) {
        const { data: leads } = await supabase
          .from('crm_leads')
          .select('*')
          .eq('user_id', userId)
          .range(from, from + step - 1);

        if (leads && leads.length > 0) {
          await Promise.all(leads.map(lead => 
            supabase.functions.invoke("facebook-capi", { 
              body: { record: lead },
              headers: { Authorization: `Bearer ${session.access_token}` }
            })
          ));
          total += leads.length;
          from += step;
          if (leads.length < step) hasMore = false;
        } else hasMore = false;
      }
      toast({ title: "Sucesso!", description: `${total} leads sincronizados com a CAPI.` });
    } catch (err: any) {
      toast({ title: "Erro Sync", description: err.message, variant: "destructive" });
    } finally { setIsSyncing(false); }
  };

  const processCSV = async (file: File, flow: 'facebook' | 'crm') => {
    if (!selectedCampaign) {
      toast({ title: "Atenção", description: "Selecione a Campanha de vínculo primeiro.", variant: "destructive" });
      return;
    }
    
    setIsUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: flow === 'facebook' ? '\t' : ',',
      complete: async (results) => {
        try {
          if (flow === 'facebook') {
            const leadsParaSalvar = (results.data as any[])
              .filter((row: any) => row.email || row.Email || row.Nome)
              .map((row) => normalizeLeadData(row, selectedCampaign, userId));

            const { error } = await supabase
              .from('crm_leads')
              .upsert(leadsParaSalvar, { onConflict: 'user_id,email', ignoreDuplicates: false });

            if (error) throw error;
          } else {
            const crmRows = results.data as any[];
            const { data: existing } = await supabase.from('crm_leads').select('email').eq('user_id', userId);
            const existingSet = new Set(existing?.map(l => l.email.toLowerCase()));
            
            const toUpdate = crmRows.map(row => {
              const email = (row.Email || row.email || row['E-mail'])?.trim()?.toLowerCase();
              if (!email || row['Situação'] === "Atendimento Finalizado") return null;
              
              const statusMapeado = mapStatusToMeta(row['Situação Atendimento'] || row.Status);
              if (existingSet.has(email) || statusMapeado === "Purchase") {
                return {
                  user_id: userId,
                  email,
                  nome: row.Cliente || row.Nome,
                  situacao_atendimento: statusMapeado,
                  campanha_nome: selectedCampaign
                };
              }
              return null;
            }).filter(Boolean);

            if (toUpdate.length > 0) {
              const { error } = await supabase.from('crm_leads').upsert(toUpdate, { onConflict: 'user_id,email' });
              if (error) throw error;
            }
          }
          toast({ title: "Importação Concluída", description: "Base de leads atualizada com sucesso." });
          onUploadComplete();
        } catch (err: any) {
          toast({ title: "Erro no processamento", description: err.message, variant: "destructive" });
        } finally { setIsUploading(false); }
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#f90f54]/10 rounded-2xl border border-[#f90f54]/20 shadow-[0_0_15px_rgba(249,15,84,0.1)]">
            <FileSpreadsheet className="w-6 h-6 text-[#f90f54]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight uppercase">Importação Estratégica</h2>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Conecte seus dados Meta Ads ao CRM</p>
          </div>
        </div>
        
        <Button 
          onClick={handleForceSync}
          disabled={isSyncing}
          className="bg-gradient-to-r from-[#f90f54] to-[#8735d2] hover:opacity-90 text-white font-bold border-none shadow-[0_0_20px_rgba(249,15,84,0.3)] transition-all uppercase text-[10px] tracking-widest h-10"
        >
          {isSyncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
          Forçar Sincronização Meta
        </Button>
      </div>

      <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 p-7 rounded-[24px] shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Etapa 1: Vínculo de Campanha</h3>
            <p className="text-[10px] text-slate-500 uppercase font-black">Obrigatório para rastreio de ROI</p>
          </div>
          <div className="w-full md:w-[400px]">
            <Select onValueChange={(val) => setSelectedCampaign(val)}>
              <SelectTrigger className="h-12 bg-[#0f172a] border-slate-700 text-slate-300 rounded-xl focus:ring-[#f90f54]/50">
                <SelectValue placeholder="Selecione a campanha de origem" />
              </SelectTrigger>
              <SelectContent className="bg-[#1e293b] border-slate-700 text-white max-h-[300px]">
                {availableCampaigns.length > 0 ? (
                  availableCampaigns.map((name, index) => (
                    <SelectItem key={index} value={name} className="focus:bg-[#f90f54]/20 focus:text-white">
                      {name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>Nenhuma campanha encontrada</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 p-8 rounded-[24px] group hover:border-[#f90f54]/30 transition-all shadow-2xl">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-400">
              <Facebook className="w-8 h-8" />
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter bg-slate-800 px-2 py-1 rounded">Origem Meta</span>
            </div>
          </div>
          <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-tight">Leads Facebook</h3>
          <p className="text-xs text-slate-400 mb-8 leading-relaxed font-medium">Importe o CSV bruto da Meta. O sistema irá atualizar dados existentes baseando-se no e-mail.</p>
          <input 
            type="file" 
            accept=".csv" 
            ref={facebookInputRef} 
            onChange={(e) => {
              if (e.target.files?.[0]) processCSV(e.target.files[0], 'facebook');
              e.target.value = '';
            }} 
            className="hidden" 
          />
          <Button 
            onClick={() => facebookInputRef.current?.click()} 
            disabled={!selectedCampaign || isUploading}
            className="w-full h-14 bg-[#0f172a] hover:bg-[#f90f54] text-white border border-slate-700 font-black rounded-xl transition-all uppercase tracking-widest text-xs"
          >
            {isUploading ? <Loader2 className="animate-spin" /> : <Upload className="w-4 h-4 mr-2" />} Subir CSV Facebook
          </Button>
        </div>

        <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 p-8 rounded-[24px] group hover:border-[#00C49F]/30 transition-all shadow-2xl">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-[#00C49F]/10 rounded-2xl border border-[#00C49F]/20 text-[#00C49F]">
              <RefreshCw className="w-8 h-8" />
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter bg-slate-800 px-2 py-1 rounded">Update CRM</span>
            </div>
          </div>
          <h3 className="text-lg font-bold text-white mb-2 uppercase tracking-tight">Sincronizar CRM</h3>
          <p className="text-xs text-slate-400 mb-8 leading-relaxed font-medium">Atualize os status das Facs para alimentar o Funil de Vendas e o cálculo de ROI Real.</p>
          <input 
            type="file" 
            accept=".csv" 
            ref={crmInputRef} 
            onChange={(e) => {
              if (e.target.files?.[0]) processCSV(e.target.files[0], 'crm');
              e.target.value = '';
            }} 
            className="hidden" 
          />
          <Button 
            onClick={() => crmInputRef.current?.click()} 
            disabled={!selectedCampaign || isUploading}
            variant="outline"
            className="w-full h-14 bg-[#00C49F]/10 hover:bg-[#00C49F] text-[#00C49F] hover:text-white border border-[#00C49F]/30 font-black rounded-xl transition-all uppercase tracking-widest text-xs"
          >
             {isUploading ? <Loader2 className="animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Sincronizar Status
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CRMUpload;