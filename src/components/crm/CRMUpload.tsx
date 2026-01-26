import { useState, useRef, useEffect } from "react";
import { Facebook, RefreshCw, Loader2, Target, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

const mapStatusToMeta = (statusCrm: any): string => {
  if (!statusCrm) return "Lead";
  const s = String(statusCrm).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (s.includes("venda")) return "Purchase";
  if (s.includes("proposta") || s.includes("negociacao")) return "SubmitApplication";
  if (s.includes("visita") || s.includes("apresentando")) return "Schedule";
  if (s.includes("atendimento") || s.includes("atend") || s.includes("dialogo")) return "Contact";
  return "Lead";
};

const CRMUpload = ({ userId, onUploadComplete }: { userId: string, onUploadComplete: () => void }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [availableCampaigns, setAvailableCampaigns] = useState<string[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const { toast } = useToast();

  const crmInputRef = useRef<HTMLInputElement>(null);
  const facebookInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      const { data } = await supabase.from('campaign_metrics').select('campaign_name').eq('user_id', userId);
      if (data) {
        const unique = Array.from(new Set(data.map(d => d.campaign_name).filter(Boolean))).sort();
        setAvailableCampaigns(unique as string[]);
      }
    };
    fetchCampaigns();
  }, [userId]);

  const processCSV = async (file: File, flow: 'facebook' | 'crm') => {
    if (!selectedCampaign) {
      toast({ variant: "destructive", title: "Atenção", description: "Selecione a Campanha primeiro." });
      return;
    }
    
    setIsUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "ISO-8859-1",
      complete: async (results) => {
        try {
          const { data: dbLeads } = await supabase.from('crm_leads').select('email').eq('user_id', userId);
          const existingEmails = new Set(dbLeads?.map(l => l.email?.toLowerCase().trim().replace(/\.com\.com$/, '.com')));

          const uniqueToUpsert = new Map();

          results.data.forEach((row: any) => {
            const rowKeys = Object.keys(row);
            const emailKey = rowKeys.find(k => k.toLowerCase().includes('email') || k.toLowerCase().includes('e-mail'));
            const statusKey = rowKeys.find(k => k.toLowerCase().includes('atendimento') || k.toLowerCase().includes('status'));
            const nameKey = rowKeys.find(k => k.toLowerCase().includes('full_name') || k.toLowerCase().includes('nome_completo') || k.toLowerCase() === 'cliente');
            const phoneKey = rowKeys.find(k => k.toLowerCase().includes('phone') || k.toLowerCase().includes('telefone'));
            const dateKey = rowKeys.find(k => k.toLowerCase() === 'created_time' || k.toLowerCase() === 'created' || k.toLowerCase() === 'cadastro');

            let email = emailKey ? String(row[emailKey] || "").trim().toLowerCase() : null;
            if (email) email = email.replace(/\.com\.com$/, '.com');

            if (email && (flow !== 'crm' || existingEmails.has(email))) {
              if (row['Situação'] === "Atendimento Finalizado" && flow === 'crm') return;

              let nomeReal = row[nameKey || ''];
              if (!nomeReal || nomeReal === 'WhatsApp' || nomeReal === 'Email') {
                 nomeReal = row['full_name'] || row['nome_completo'] || row['Cliente'] || "Sem Nome";
              }

              uniqueToUpsert.set(email, {
                user_id: userId,
                email: email,
                nome: nomeReal,
                telefone: phoneKey ? String(row[phoneKey]).replace(/\D/g, '') : undefined,
                cadastro: dateKey && row[dateKey] ? new Date(row[dateKey]).toISOString() : new Date().toISOString(),
                situacao_atendimento: flow === 'crm' ? mapStatusToMeta(row[statusKey || '']) : 'Lead',
                campanha_nome: selectedCampaign,
                updated_at: new Date().toISOString()
              });
            }
          });

          const finalData = Array.from(uniqueToUpsert.values());

          if (finalData.length > 0) {
            const { error } = await supabase.from('crm_leads').upsert(finalData, { onConflict: 'user_id,email' });
            if (error) throw error;
            toast({ title: "Sucesso!", description: `${finalData.length} leads processados.` });
          }
          onUploadComplete();
        } catch (err: any) {
          toast({ variant: "destructive", title: "Erro", description: err.message });
        } finally {
          setIsUploading(false);
        }
      }
    });
  };

  return (
    <div className="space-y-6 bg-slate-900/40 p-6 rounded-2xl border border-slate-800">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <Target className="text-[#f90f54] w-5 h-5" />
          <h2 className="text-white font-bold uppercase tracking-tight">Sincronização ROI</h2>
        </div>
        
        {/* BOTÃO RESTAURADO: Forçar Sincronização */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onUploadComplete()} 
          className="text-slate-400 hover:text-white hover:bg-white/10 text-[10px] uppercase font-bold"
        >
          <Zap className="w-3 h-3 mr-1 text-amber-500" /> Forçar Atualização
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-400 text-[10px] font-bold uppercase">Projeto Vinculado</Label>
        <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
          <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-12">
            <SelectValue placeholder="Selecione a Campanha" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 text-white border-slate-700">
            {availableCampaigns.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Button 
          onClick={() => facebookInputRef.current?.click()} 
          disabled={isUploading || !selectedCampaign} 
          className="bg-blue-600 hover:bg-blue-700 h-14 font-bold flex items-center justify-center gap-2"
        >
          {isUploading ? <Loader2 className="animate-spin h-4 w-4" /> : <Facebook className="h-4 w-4" />}
          Importar Novos Leads
        </Button>
        <Button 
          onClick={() => crmInputRef.current?.click()} 
          disabled={isUploading || !selectedCampaign} 
          variant="outline" 
          className="border-emerald-500/30 text-emerald-400 h-14 hover:bg-emerald-500 font-bold flex items-center justify-center gap-2"
        >
          {isUploading ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
          Sincronizar CRM
        </Button>
        <input type="file" ref={facebookInputRef} accept=".csv" onChange={(e) => e.target.files?.[0] && processCSV(e.target.files[0], 'facebook')} className="hidden" />
        <input type="file" ref={crmInputRef} accept=".csv" onChange={(e) => e.target.files?.[0] && processCSV(e.target.files[0], 'crm')} className="hidden" />
      </div>
    </div>
  );
};

export default CRMUpload;