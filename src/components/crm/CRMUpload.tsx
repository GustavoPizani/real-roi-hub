import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

interface CRMUploadProps {
  userId: string;
  onUploadComplete: () => void;
}

const CRMUpload = ({ userId, onUploadComplete }: CRMUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState<{ inserted: number; updated: number } | null>(null);
  const { toast } = useToast();

  const parseBrazilianDate = (dateStr: string) => {
    if (!dateStr) return null;
    const [day, month, year] = dateStr.split('/');
    return new Date(`${year}-${month}-${day}`).toISOString();
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && file.type === "text/csv") {
        await processCSV(file);
      } else {
        toast({
          title: "Formato inválido",
          description: "Por favor, envie um arquivo CSV",
          variant: "destructive",
        });
      }
    },
    [userId]
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processCSV(file);
    }
  };

  const processCSV = async (file: File) => {
    setIsUploading(true);
    setUploadStats(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          let inserted = 0;
          let updated = 0;

          for (const row of results.data as any[]) {
            const lead = {
              user_id: userId,
              fac_id: row["Fac_id"] || row["fac_id"] || null,
              email: row["Email"] || row["email"] || null,
              nome: row["Nome"] || row["nome"] || null,
              telefone: row["Telefone"] || row["telefone"] || null,
              empreendimento: row["Empreendimento"] || row["empreendimento"] || null,
              situacao_atendimento: row["Situação Atendimento"] || row["situacao_atendimento"] || null,
              canal: row["Canal"] || row["canal"] || null,
              corretor: row["Corretor"] || row["corretor"] || null,
              cadastro: parseBrazilianDate(row["Cadastro"] || row["cadastro"]),
              atualizacao: parseBrazilianDate(row["Atualização"] || row["atualizacao"]),
            };

            // Build a query to find existing lead by email or phone
            const orConditions = [];
            if (lead.email) orConditions.push(`email.eq.${lead.email}`);
            if (lead.telefone) orConditions.push(`telefone.eq.${lead.telefone}`);

            let existingLead = null;
            if (orConditions.length > 0) {
              const { data } = await supabase
                .from("crm_leads")
                .select("id")
                .eq("user_id", userId)
                .or(orConditions.join(','))
                .maybeSingle();
              existingLead = data;
            }

            if (existingLead) {
              // If lead exists, update it with all new data from CSV, except identifiers
              const { id, user_id, email, telefone, ...updateData } = lead;
              await supabase
                .from("crm_leads")
                .update(updateData)
                .eq("id", existingLead.id);
              updated++;
            } else {
              // Insert new lead
              await supabase.from("crm_leads").insert(lead);
              inserted++;
            }
          }

          setUploadStats({ inserted, updated });
          toast({
            title: "Upload concluído",
            description: `${inserted} novos leads, ${updated} atualizados`,
          });
          onUploadComplete();
        } catch (error: any) {
          console.error("CSV processing error:", error);
          toast({
            title: "Erro no processamento",
            description: error.message,
            variant: "destructive",
          });
        } finally {
          setIsUploading(false);
        }
      },
      error: (error) => {
        toast({
          title: "Erro ao ler CSV",
          description: error.message,
          variant: "destructive",
        });
        setIsUploading(false);
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">CRM Upload</h2>
          <p className="text-sm text-muted-foreground">Importe seus leads do CRM via CSV</p>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`glass-card p-12 border-2 border-dashed transition-all ${
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
        }`}
      >
        <div className="text-center">
          {isUploading ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-lg font-medium">Processando CSV...</p>
              <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos</p>
            </div>
          ) : (
            <>
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">Arraste seu arquivo CSV aqui</p>
              <p className="text-sm text-muted-foreground mb-4">ou clique para selecionar</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="csv-upload"
              />
              <Button asChild variant="secondary" className="bg-primary/10 hover:bg-primary/20 text-primary">
                <label htmlFor="csv-upload" className="cursor-pointer">
                  Selecionar arquivo
                </label>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Upload Stats */}
      {uploadStats && (
        <div className="glass-card p-4 border-neon-green/30 animate-fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-neon-green flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-neon-green">Upload concluído</p>
              <p className="text-sm text-muted-foreground">
                {uploadStats.inserted} leads inseridos, {uploadStats.updated} atualizados
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="glass-card p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Formato esperado</p>
            <p className="text-sm text-muted-foreground mt-1">
              O CSV deve conter as colunas: Nome, Email, Telefone, Empreendimento, Situação Atendimento, Canal, Corretor, Cadastro, Atualização
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CRMUpload;
