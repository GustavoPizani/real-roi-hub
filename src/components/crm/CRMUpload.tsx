import { useState, useCallback, useRef } from "react";
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

const formatAndScanLead = (row: any, campaignName: string, userId: string) => {
  // Mapeamento exato das colunas do seu CSV anexado
  const rawPhone = row.phone || ""; 
  const rawId = row.id || ""; // ID do lead (ex: l:2097...)
  const rawAdId = row.ad_id || ""; // ID do anúncio (ex: ag:1202...)
  const rawDate = row.created_time || "";

  // --- LIMPEZA DE TELEFONE (Remove p:+, espaços e não-números) ---
  // Substitui o "p:+" por vazio e depois remove tudo que não for dígito
  let cleanPhone = rawPhone.toString().replace(/p:\+/g, '').replace(/\D/g, '');
  
  // Adiciona o prefixo do país se faltar
  if (cleanPhone.length === 11 || cleanPhone.length === 10) {
    cleanPhone = `55${cleanPhone}`;
  }

  // --- IDENTIFICAÇÃO DE SINCRONIA ---
  // Se o ID do anúncio começa com 'ag:', marcamos a origem
  const isMetaTrace = rawAdId.toString().startsWith('ag:');

  return {
    user_id: userId,
    email: row.email || "",
    nome: row.full_name || "Sem Nome",
    telefone: cleanPhone,
    cadastro: new Date(rawDate).toISOString(),
    campanha_nome: campaignName,
    fac_id: rawAdId, // Usamos o ag: como fac_id para o seu filtro de rastro
    origem_importacao: isMetaTrace ? 'meta_trace' : 'facebook_csv',
    situacao_atendimento: 'Novo'
  };
};

// Função de mapeamento de status para o CRM -> Meta CAPI
const mapStatus = (status: string): string => {
  const lowerStatus = status?.toLowerCase() || '';
  if (lowerStatus.includes('interessado')) return 'Interessado';
  if (lowerStatus.includes('venda')) return 'Venda';
  if (lowerStatus.includes('visita')) return 'Visita';
  return status || 'Novo';
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
    if (file) {
      await processCSV(file, flow);
    }
    if (e.target) e.target.value = ''; // Reset input to allow re-uploading the same file
  };

  const processCSV = async (file: File, flow: 'facebook' | 'crm') => {
    if (!selectedCampaign) {
        toast({ title: "Erro", description: "Por favor, selecione uma campanha antes de fazer o upload.", variant: "destructive" });
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
            const leadsParaSalvar = (results.data as any[])
              .filter((row: any) => row.email || row.phone)
              .map((row) => formatAndScanLead(row, selectedCampaign, userId));

            console.log("=== SCAN DE DIAGNÓSTICO CRM (FACEBOOK) ===");
            console.log("Total Processado:", leadsParaSalvar.length);
            if (leadsParaSalvar.length > 0) console.log("Exemplo de Lead:", leadsParaSalvar[0]);

            // LOGICA: ignoreDuplicates: true garante que leads antigos NÃO sejam tocados
            const { error: fbError } = await supabase
              .from('crm_leads')
              .upsert(leadsParaSalvar, { 
                onConflict: 'user_id,email',
                ignoreDuplicates: true 
              });

            if (fbError) throw fbError;

            toast({ title: "Sucesso!", description: `${leadsParaSalvar.length} novos leads importados. Leads já existentes foram preservados.` });
            onUploadComplete();
          } else {
            // FLUXO CRM: Sincronização de Status apenas
            const crmRows = results.data as any[];
            
            // Preparar dados para sincronização - apenas email, user_id e status
            const leadsParaSincronizar = crmRows.map(row => {
              return {
                user_id: userId,
                email: row.email || row.Email,
                // Mapeamos o status convertido
                situacao_atendimento: mapStatus(row.situacao_atendimento || row.Status || 'Novo'),
              };
            }).filter(lead => lead.email);

            // LOGICA: ignoreDuplicates: false para atualizar status existentes
            const { error: crmError } = await supabase
              .from('crm_leads')
              .upsert(leadsParaSincronizar, { 
                onConflict: 'user_id,email',
                ignoreDuplicates: false 
              });

            if (crmError) throw crmError;

            toast({ 
              title: "Sincronização Concluída", 
              description: `${leadsParaSincronizar.length} leads atualizados com dados do CRM.` 
            });
            
            onUploadComplete();
          }
        } catch (error: any) {
          console.error("Erro no processamento do CSV:", error);
          toast({
            title: "Erro no processamento",
            description: error.message,
            variant: "destructive",
          });
        } finally {
          setIsUploading(false);
        }
      },
      error: (err) => {
        toast({
          title: "Erro ao ler CSV",
          description: err.message,
          variant: "destructive",
        });
        setIsUploading(false);
      },
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
              {campaigns && campaigns.length > 0 ? (
                campaigns
                  .filter(cap => cap.campaignName && cap.campaignName.trim() !== "")
                  .map((cap) => (
                    <SelectItem key={cap.campaignName} value={cap.campaignName}>
                      {cap.campaignName}
                    </SelectItem>
                  ))
              ) : (
                <SelectItem value="empty" disabled>Carregando campanhas da Meta...</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isUploading ? (
        <div className="glass-card p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-lg font-medium">Processando arquivo...</p>
            <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos. Não feche esta página.</p>
          </div>
        </div>
      ) : (
        <div>
        <h3 className="text-md font-semibold mb-2 mt-6">Etapa 2: Importe seu arquivo</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Facebook Leads Upload */}
          <div className="glass-card p-6 flex flex-col items-center justify-center text-center border-dashed border-2 border-transparent hover:border-primary/50 hover:bg-primary/5 transition-all">
            <Facebook className="w-10 h-10 text-primary mb-3" />
            <h3 className="text-lg font-semibold mb-1">Importar Leads Facebook</h3>
            <p className="text-sm text-muted-foreground mb-4">Use o CSV exportado da sua biblioteca de formulários.</p>
            <input type="file" accept=".csv" ref={facebookInputRef} onChange={(e) => handleFileSelect(e, 'facebook')} className="hidden" />
            <Button onClick={() => facebookInputRef.current?.click()} disabled={!selectedCampaign || isUploading} className="w-full gap-2">
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? "Processando..." : "Subir Leads da Campanha"}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">Formato esperado: delimitado por tabulação</p>
          </div>

          {/* CRM Sync Upload */}
          <div className="glass-card p-6 flex flex-col items-center justify-center text-center border-dashed border-2 border-transparent hover:border-neon-green/50 hover:bg-neon-green/5 transition-all">
            <RefreshCw className="w-10 h-10 text-neon-green mb-3" />
            <h3 className="text-lg font-semibold mb-1">Sincronizar Dados CRM</h3>
            <p className="text-sm text-muted-foreground mb-4">Atualize o status dos leads para a API de Conversão.</p>
            <input type="file" accept=".csv" ref={crmInputRef} onChange={(e) => handleFileSelect(e, 'crm')} className="hidden" />
            <Button onClick={() => crmInputRef.current?.click()} variant="secondary" disabled={!selectedCampaign || isUploading} className="bg-neon-green/10 hover:bg-neon-green/20 text-neon-green w-full gap-2">
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? "Processando..." : "Subir Leads da Campanha"}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">Formato esperado: delimitado por vírgula</p>
          </div>
        </div>
        </div>
      )}

      {/* Upload Stats */}
      {uploadStats && (
        <div className="glass-card p-4 border-neon-green/30 animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-neon-green flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-neon-green">Processamento concluído</p>
              <p className="text-sm text-muted-foreground">
                {uploadStats.inserted} leads inseridos, {uploadStats.updated} atualizados
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMUpload;
