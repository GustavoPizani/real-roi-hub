import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Facebook, RefreshCw, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

interface CampaignData {
  campaignName?: string; // Formato antigo
  name?: string;         // Formato novo vindo do campaignPerformance
}

interface CRMUploadProps {
  userId: string;
  onUploadComplete: () => void;
  campaigns: CampaignData[];
}

// 1. MAPEAMENTO DE STATUS (Mantido conforme regra de negócio aprovada)
const mapStatusToMeta = (statusCrm: string): string => {
  if (!statusCrm) return "Lead";
  const s = statusCrm.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (s.includes("venda")) return "Purchase";
  if (s.includes("proposta") || s.includes("negociacao")) return "SubmitApplication";
  if (s.includes("visita")) return "Schedule";
  if (s.includes("atendimento") || s.includes("contato")) return "Contact";
  if (s.includes("novo")) return "Novo";
  return "Lead";
};

// 2. NORMALIZAÇÃO DE LEADS (Combina mapeamento inteligente com lógica de negócio)
const normalizeLeadData = (row: any, campaignName: string, userId: string) => {
  // Mapeamento inteligente de colunas (Suporta Meta Ads e Planilhas Manuais)
  const email = row.email || row.Email || row.E_mail || row['E-mail'];
  const nome = row.full_name || row.Cliente || row.nome || row.Nome || "Sem Nome";
  const telefone = row.phone || row.Telefone || row.telefone || row.phone_number;
  const dataCriacao = row.created_time || row.Cadastro || row.data_cadastro || new Date().toISOString();
  const rawAdId = row.ad_id || ""; // Preserva o ad_id original da Meta

  // Lógica de limpeza de telefone da função anterior
  let cleanPhone = telefone ? String(telefone).replace(/p:\+/g, '').replace(/\D/g, '') : '';
  if (cleanPhone.length === 11 || cleanPhone.length === 10) {
    cleanPhone = `55${cleanPhone}`;
  }

  const isMetaTrace = rawAdId.toString().startsWith('ag:');

  return {
    user_id: userId,
    email: email?.toLowerCase().trim(),
    nome: nome,
    telefone: cleanPhone,
    cadastro: new Date(dataCriacao).toISOString(), // Garante o formato ISO
    campanha_nome: campaignName,
    fac_id: rawAdId, // Essencial para a CAPI da Meta
    origem_importacao: isMetaTrace ? 'meta_trace' : 'facebook_csv',
    situacao_atendimento: 'Novo' // Leads da Meta sempre entram como 'Novo'
  };
};

const CRMUpload = ({ userId, onUploadComplete, campaigns }: CRMUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const facebookInputRef = useRef<HTMLInputElement>(null);
  const crmInputRef = useRef<HTMLInputElement>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, flow: 'facebook' | 'crm') => {
    const file = e.target.files?.[0];
    if (file) await processCSV(file, flow);
    if (e.target) e.target.value = ''; 
  };

  const processCSV = async (file: File, flow: 'facebook' | 'crm') => {
    if (!selectedCampaign) {
      toast({ title: "Erro", description: "Selecione uma campanha antes de subir o arquivo.", variant: "destructive" });
      return;
    }
    
    setIsUploading(true);
    const delimiter = flow === 'facebook' ? '\t' : ',';

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter,
      complete: async (results) => {
        try {
          if (flow === 'facebook') {
            const leadsParaSalvar = (results.data as any[])
              .filter((row: any) => row.email || row.phone)
              .map((row) => normalizeLeadData(row, selectedCampaign, userId));

            const { error } = await supabase
              .from('crm_leads')
              .upsert(leadsParaSalvar, { 
                onConflict: 'user_id,email',
                ignoreDuplicates: true 
              });

            if (error) throw error;
            toast({ title: "Importação Concluída", description: "Novos leads inseridos no sistema." });
          } else {
            // --- FLUXO CRM: SINCRONIZAÇÃO SEGURA (APENAS STATUS) ---
            const crmRows = results.data as any[];
            const leadsParaSincronizar = crmRows.map(row => {
              const email = (row.Email || row.email || row['E-mail'])?.trim();
              if (!email) return null;

              const statusBruto = row['Situação Atendimento'] || row.situacao_atendimento || row.Status;

              return {
                user_id: userId,
                email: email.toLowerCase(),
                situacao_atendimento: mapStatusToMeta(statusBruto), // Converte conforme sua planilha
                // REMOVEMOS NOME E TELEFONE DAQUI PARA PROTEGER O CRM
              };
            }).filter(Boolean);

            const { error } = await supabase
              .from('crm_leads')
              .upsert(leadsParaSincronizar, { 
                onConflict: 'user_id,email',
                ignoreDuplicates: false 
              });

            if (error) throw error;
            toast({ title: "Sincronização OK", description: "Status atualizados com sucesso." });
          }
          onUploadComplete();
        } catch (error: any) {
          console.error("Erro:", error);
          toast({ title: "Erro no processamento", description: error.message, variant: "destructive" });
        } finally {
          setIsUploading(false);
        }
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Título e Subtítulo */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-[#f90f54]/10 rounded-2xl border border-[#f90f54]/20 shadow-[0_0_15px_rgba(249,15,84,0.1)]">
          <FileSpreadsheet className="w-6 h-6 text-[#f90f54]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight uppercase">Importação Estratégica</h2>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Conecte seus dados Meta Ads ao CRM</p>
        </div>
      </div>

      {/* Seletor de Campanha - Estilo Glassmorphism */}
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
              <SelectContent className="bg-[#1e293b] border-slate-700 text-white">
                {/* AJUSTE AQUI: Mapeia tanto .name quanto .campaignName para garantir compatibilidade */}
                {campaigns && campaigns.length > 0 ? (
                  campaigns.map((cap, index) => {
                    const name = cap.name || cap.campaignName;
                    if (!name) return null;
                    return (
                      <SelectItem key={index} value={name} className="focus:bg-[#f90f54]/20 focus:text-white">
                        {name}
                      </SelectItem>
                    );
                  })
                ) : (
                  <SelectItem value="none" disabled>Nenhuma campanha encontrada</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isUploading ? (
        <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 p-20 rounded-[24px] text-center flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-12 h-12 text-[#f90f54] animate-spin" />
          <p className="text-lg font-bold text-white uppercase tracking-tighter">Processando Inteligência de Dados...</p>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Não feche esta janela</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* CARD FACEBOOK */}
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
            <p className="text-xs text-slate-400 mb-8 leading-relaxed font-medium">Importe o CSV bruto da Meta. O sistema irá ignorar duplicados e preservar status antigos do CRM.</p>
            
            <input type="file" accept=".csv" ref={facebookInputRef} onChange={(e) => handleFileSelect(e, 'facebook')} className="hidden" />
            <Button 
              onClick={() => facebookInputRef.current?.click()} 
              disabled={!selectedCampaign}
              className="w-full h-14 bg-[#0f172a] hover:bg-[#f90f54] text-white border border-slate-700 font-black rounded-xl transition-all uppercase tracking-widest text-xs"
            >
              <Upload className="w-4 h-4 mr-2" /> Subir CSV Facebook
            </Button>
          </div>

          {/* CARD CRM SYNC */}
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
            <p className="text-xs text-slate-400 mb-8 leading-relaxed font-medium">Atualize os status das Facs. Isso alimenta o Funil de Vendas e o cálculo de ROI Real automaticamente.</p>
            
            <input type="file" accept=".csv" ref={crmInputRef} onChange={(e) => handleFileSelect(e, 'crm')} className="hidden" />
            <Button 
              onClick={() => crmInputRef.current?.click()} 
              disabled={!selectedCampaign}
              variant="outline"
              className="w-full h-14 bg-[#00C49F]/10 hover:bg-[#00C49F] text-[#00C49F] hover:text-white border border-[#00C49F]/30 font-black rounded-xl transition-all uppercase tracking-widest text-xs"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Sincronizar Status
            </Button>
          </div>
        </div>
      )}

      {/* DICA DE INTELIGÊNCIA */}
      <div className="flex items-center gap-3 p-4 bg-slate-800/30 rounded-2xl border border-slate-700/50 text-slate-500">
        <Info className="w-4 h-4 text-[#f90f54]" />
        <p className="text-[10px] font-bold uppercase tracking-wider">Lembre-se: O e-mail é a chave de sincronia. Dados sem e-mail serão ignorados pelo motor de IA.</p>
      </div>
    </div>
  );
};

export default CRMUpload;