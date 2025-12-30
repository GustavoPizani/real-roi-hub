import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, Facebook, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

interface CampaignData {
  campaignName: string;
}

interface CRMUploadProps {
  userId: string;
  onUploadComplete: () => void;
  campaigns: CampaignData[];
}

// 1. MAPEAMENTO DE STATUS (Baseado na planilha enviada)
const mapStatusToMeta = (statusCrm: string): string => {
  if (!statusCrm) return "Lead";

  // Normaliza: minúsculo, sem espaços nas pontas e sem acentos
  const s = statusCrm
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (s.includes("venda")) return "Purchase";
  if (s.includes("proposta") || s.includes("negociacao")) return "SubmitApplication";
  if (s.includes("visita")) return "Schedule"; // Agora reconhece "Visita" da sua planilha
  if (s.includes("atendimento") || s.includes("contato")) return "Contact";
  if (s.includes("novo")) return "Novo";

  return "Lead";
};

// 2. FORMATAÇÃO DE LEADS NOVOS (Facebook)
const formatAndScanLead = (row: any, campaignName: string, userId: string) => {
  const rawPhone = row.phone || ""; 
  const rawAdId = row.ad_id || ""; 
  const rawDate = row.created_time || "";

  // Limpeza de telefone (Remove p:+ e não-números)
  let cleanPhone = rawPhone.toString().replace(/p:\+/g, '').replace(/\D/g, '');
  if (cleanPhone.length === 11 || cleanPhone.length === 10) {
    cleanPhone = `55${cleanPhone}`;
  }

  const isMetaTrace = rawAdId.toString().startsWith('ag:');

  return {
    user_id: userId,
    email: row.email || "",
    nome: row.full_name || "Sem Nome",
    telefone: cleanPhone,
    cadastro: new Date(rawDate).toISOString(),
    campanha_nome: campaignName,
    fac_id: rawAdId,
    origem_importacao: isMetaTrace ? 'meta_trace' : 'facebook_csv',
    situacao_atendimento: 'Novo'
  };
};

const CRMUpload = ({ userId, onUploadComplete, campaigns }: CRMUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState<{ inserted: number; updated: number } | null>(null);
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
    setUploadStats(null);

    const delimiter = flow === 'facebook' ? '\t' : ',';

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter,
      complete: async (results) => {
        try {
          if (flow === 'facebook') {
            // --- FLUXO FACEBOOK: APENAS LEADS NOVOS ---
            const leadsParaSalvar = (results.data as any[])
              .filter((row: any) => row.email || row.phone)
              .map((row) => formatAndScanLead(row, selectedCampaign, userId));

            const { error } = await supabase
              .from('crm_leads')
              .upsert(leadsParaSalvar, { 
                onConflict: 'user_id,email',
                ignoreDuplicates: true // GARANTE: Não mexe em leads que já existem
              });

            if (error) throw error;
            toast({ title: "Importação Concluída", description: "Novos leads inseridos. Dados antigos preservados." });
            onUploadComplete();

          } else {
            // --- FLUXO CRM: SINCRONIZAÇÃO BASEADA NO CSV REAL ---
            const crmRows = results.data as any[];
            
            const leadsParaSincronizar = crmRows.map(row => {
              // Captura o email usando o nome exato da coluna da sua planilha: 'Email'
              const email = row.Email || row.email || row['E-mail'];
              if (!email) return null;

              // Captura a Situação usando o nome exato: 'Situação Atendimento'
              const statusBruto = row['Situação Atendimento'] || row.situacao_atendimento || row.Status;
              const novoStatus = mapStatusToMeta(statusBruto);
              
              // Captura o Fac ID (substitui o ag:... da Meta)
              const crmId = row.Fac || row.fac_id || row.id || row.ID;

              // Monta o objeto de atualização
              const updateObj: any = {
                user_id: userId,
                email: email.trim(),
                situacao_atendimento: novoStatus,
                origem_importacao: 'crm_sync'
              };

              // Só atualiza o fac_id se ele não estiver vazio no CSV
              if (crmId && crmId.toString().trim() !== "") {
                updateObj.fac_id = crmId.toString().trim();
              }

              return updateObj;
            }).filter(lead => lead !== null);

            // Executa o upsert permitindo atualizações constantes
            const { error } = await supabase
              .from('crm_leads')
              .upsert(leadsParaSincronizar, { 
                onConflict: 'user_id,email',
                ignoreDuplicates: false 
              });

            if (error) throw error;
            toast({ title: "Sucesso!", description: `${leadsParaSincronizar.length} status atualizados.` });
            onUploadComplete();
          }
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
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Importação de Dados</h2>
          <p className="text-sm text-muted-foreground">Importe novos leads ou sincronize dados do seu CRM.</p>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="space-y-4 mb-6">
          <label className="text-sm font-medium">Campanha Vinculada (Obrigatório)</label>
          <Select onValueChange={(val) => setSelectedCampaign(val)}>
            <SelectTrigger className="w-full bg-surface-2 border-border">
              <SelectValue placeholder="Selecione a campanha antes de subir o arquivo" />
            </SelectTrigger>
            <SelectContent>
              {campaigns?.filter(cap => cap.campaignName?.trim()).map((cap) => (
                <SelectItem key={cap.campaignName} value={cap.campaignName}>
                  {cap.campaignName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isUploading ? (
        <div className="glass-card p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-lg font-medium">Processando arquivo...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* FACEBOOK */}
          <div className="glass-card p-6 flex flex-col items-center text-center border-dashed border-2 border-transparent hover:border-primary/50 transition-all">
            <Facebook className="w-10 h-10 text-primary mb-3" />
            <h3 className="text-lg font-semibold">Leads Facebook</h3>
            <p className="text-sm text-muted-foreground mb-4">Apenas novos leads (ignora duplicados).</p>
            <input type="file" accept=".csv" ref={facebookInputRef} onChange={(e) => handleFileSelect(e, 'facebook')} className="hidden" />
            <Button onClick={() => facebookInputRef.current?.click()} disabled={!selectedCampaign} className="w-full">
              <Upload className="w-4 h-4 mr-2" /> Subir CSV Facebook
            </Button>
          </div>

          {/* CRM SYNC */}
          <div className="glass-card p-6 flex flex-col items-center text-center border-dashed border-2 border-transparent hover:border-neon-green/50 transition-all">
            <RefreshCw className="w-10 h-10 text-neon-green mb-3" />
            <h3 className="text-lg font-semibold">Sincronizar CRM</h3>
            <p className="text-sm text-muted-foreground mb-4">Atualiza APENAS o status dos leads existentes.</p>
            <input type="file" accept=".csv" ref={crmInputRef} onChange={(e) => handleFileSelect(e, 'crm')} className="hidden" />
            <Button onClick={() => crmInputRef.current?.click()} variant="secondary" disabled={!selectedCampaign} className="bg-neon-green/10 text-neon-green w-full">
              <Upload className="w-4 h-4 mr-2" /> Sincronizar Status
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMUpload;