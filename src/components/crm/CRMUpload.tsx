import { useState, useCallback, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, Facebook, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

interface CRMUploadProps {
  userId: string;
  onUploadComplete: () => void;
}

const CRMUpload = ({ userId, onUploadComplete }: CRMUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState<{ inserted: number; updated: number } | null>(null);
  const { toast } = useToast();

  const facebookInputRef = useRef<HTMLInputElement>(null);
  const crmInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, flow: 'facebook' | 'crm') => {
    const file = e.target.files?.[0];
    if (file) {
      await processCSV(file, flow);
    }
    if (e.target) e.target.value = ''; // Reset input to allow re-uploading the same file
  };

  const processCSV = async (file: File, flow: 'facebook' | 'crm') => {
    setIsUploading(true);
    setUploadStats(null);

    const delimiter = flow === 'facebook' ? '\t' : ',';

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter,
      complete: async (results) => {
        try {
          let inserted = 0;
          let updated = 0;

          for (const row of results.data as any[]) {
            const email = (row.email || row.Email)?.trim();
            if (!email) {
              console.warn("Linha pulada por falta de e-mail:", row);
              continue; // Email is essential for both flows
            }

            const { data: existingLead } = await supabase
              .from('crm_leads')
              .select('id, fac_id')
              .eq('user_id', userId)
              .eq('email', email)
              .maybeSingle();

            if (flow === 'facebook') {
              const newFacId = row.ad_id?.trim();
              if (existingLead) {
                if (!existingLead.fac_id && newFacId) {
                  const { error } = await supabase
                    .from('crm_leads')
                    .update({ fac_id: newFacId, atualizacao: new Date().toISOString() })
                    .eq('id', existingLead.id);
                  if (error) throw error;
                  updated++;
                }
              } else {
                const newLead = {
                  user_id: userId,
                  nome: row.full_name?.trim(),
                  email: email,
                  telefone: row.phone_number?.trim(),
                  fac_id: newFacId,
                  cadastro: row.created_time ? new Date(parseInt(row.created_time) * 1000).toISOString() : new Date().toISOString(),
                  canal: 'Facebook Leads',
                  situacao_atendimento: 'Novo',
                  atualizacao: new Date().toISOString(),
                };
                const { error } = await supabase.from('crm_leads').insert(newLead);
                if (error) throw error;
                inserted++;
              }
            } else if (flow === 'crm') {
              if (existingLead) {
                const updatePayload: { [key: string]: any } = {
                  atualizacao: new Date().toISOString(),
                };
                if (row['Situação Atendimento']) updatePayload.situacao_atendimento = row['Situação Atendimento'].trim();
                if (row['Corretor']) updatePayload.corretor = row['Corretor'].trim();
                if (row['Fac']) updatePayload.fac_id = row['Fac'].trim();

                const { error } = await supabase
                  .from('crm_leads')
                  .update(updatePayload)
                  .eq('id', existingLead.id);
                if (error) throw error;
                updated++;
              } else {
                const newLead = {
                  user_id: userId,
                  nome: row.Cliente?.trim(),
                  email: email,
                  telefone: row.Telefone?.trim(),
                  situacao_atendimento: row['Situação Atendimento']?.trim() || 'Novo',
                  corretor: row.Corretor?.trim(),
                  fac_id: row.Fac?.trim(),
                  canal: 'CRM Sync',
                  cadastro: new Date().toISOString(),
                  atualizacao: new Date().toISOString(),
                };
                const { error } = await supabase.from('crm_leads').insert(newLead);
                if (error) throw error;
                inserted++;
              }
            }
          }

          setUploadStats({ inserted, updated });
          toast({
            title: "Upload concluído",
            description: `${inserted} leads inseridos, ${updated} atualizados.`,
          });
          onUploadComplete();
        } catch (error: any) {
          console.error("CSV processing error:", error);
          toast({
            title: "Erro no processamento",
            description: "Verifique o formato do arquivo e as colunas. " + error.message,
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

      {isUploading ? (
        <div className="glass-card p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-lg font-medium">Processando arquivo...</p>
            <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos. Não feche esta página.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Facebook Leads Upload */}
          <div className="glass-card p-6 flex flex-col items-center justify-center text-center border-dashed border-2 border-transparent hover:border-primary/50 hover:bg-primary/5 transition-all">
            <Facebook className="w-10 h-10 text-primary mb-3" />
            <h3 className="text-lg font-semibold mb-1">Importar Leads Facebook</h3>
            <p className="text-sm text-muted-foreground mb-4">Use o CSV exportado da sua biblioteca de formulários.</p>
            <input type="file" accept=".csv" ref={facebookInputRef} onChange={(e) => handleFileSelect(e, 'facebook')} className="hidden" />
            <Button onClick={() => facebookInputRef.current?.click()} disabled={isUploading}>
              <Upload className="w-4 h-4 mr-2" />
              Selecionar Arquivo
            </Button>
            <p className="text-xs text-muted-foreground mt-2">Formato esperado: delimitado por tabulação</p>
          </div>

          {/* CRM Sync Upload */}
          <div className="glass-card p-6 flex flex-col items-center justify-center text-center border-dashed border-2 border-transparent hover:border-neon-green/50 hover:bg-neon-green/5 transition-all">
            <RefreshCw className="w-10 h-10 text-neon-green mb-3" />
            <h3 className="text-lg font-semibold mb-1">Sincronizar Dados CRM</h3>
            <p className="text-sm text-muted-foreground mb-4">Atualize o status dos leads para a API de Conversão.</p>
            <input type="file" accept=".csv" ref={crmInputRef} onChange={(e) => handleFileSelect(e, 'crm')} className="hidden" />
            <Button onClick={() => crmInputRef.current?.click()} variant="secondary" disabled={isUploading} className="bg-neon-green/10 hover:bg-neon-green/20 text-neon-green">
              <Upload className="w-4 h-4 mr-2" />
              Selecionar Arquivo
            </Button>
            <p className="text-xs text-muted-foreground mt-2">Formato esperado: delimitado por vírgula</p>
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
