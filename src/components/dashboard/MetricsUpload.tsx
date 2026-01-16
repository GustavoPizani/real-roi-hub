import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

interface MetricsUploadProps {
  userId: string;
  onUploadComplete: () => void;
}

interface ParsedMetric {
  campaign_name: string;
  ad_set_name?: string;
  ad_name?: string;
  creative_name?: string;
  date: string;
  impressions: number;
  clicks: number;
  link_clicks: number;
  unique_link_clicks: number;
  reach: number;
  spend: number;
  leads: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpl: number;
  frequency: number;
  thumbnail_url?: string;
  channel: string;
}

const normalizeHeader = (header: string): string => {
  const normalized = header.toLowerCase().trim().replace(/\s+/g, '_');
  const mapping: Record<string, string> = {
    'campaign_name': 'campaign_name',
    'campanha': 'campaign_name',
    'nome_da_campanha': 'campaign_name',
    'ad_set_name': 'ad_set_name',
    'conjunto': 'ad_set_name',
    'nome_do_conjunto': 'ad_set_name',
    'ad_name': 'ad_name',
    'anúncio': 'ad_name',
    'nome_do_anúncio': 'ad_name',
    'creative_name': 'creative_name',
    'criativo': 'creative_name',
    'ad_creative_name': 'creative_name',
    'date': 'date',
    'data': 'date',
    'dia': 'date',
    'impressions': 'impressions',
    'impressões': 'impressions',
    'clicks': 'clicks',
    'cliques': 'clicks',
    'link_clicks': 'link_clicks',
    'cliques_no_link': 'link_clicks',
    'unique_link_clicks': 'unique_link_clicks',
    'reach': 'reach',
    'alcance': 'reach',
    'spend': 'spend',
    'amount_spend': 'spend',
    'amount_spent': 'spend',
    'gasto': 'spend',
    'investimento': 'spend',
    'leads': 'leads',
    'conversions': 'conversions',
    'conversões': 'conversions',
    'ctr': 'ctr',
    'cpc': 'cpc',
    'cpm': 'cpm',
    'cpl': 'cpl',
    'cpv': 'cpl',
    'frequency': 'frequency',
    'frequência': 'frequency',
    'thumbnail': 'thumbnail_url',
    'thumbnail_url': 'thumbnail_url',
    'imagem': 'thumbnail_url',
    'channel': 'channel',
    'canal': 'channel',
  };
  return mapping[normalized] || normalized;
};

const parseNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const cleaned = String(value).replace(/[R$\s%]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

const parseDate = (value: any): string => {
  if (!value) return new Date().toISOString().split('T')[0];
  const str = String(value);
  // Try different date formats
  const formats = [
    /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
    /(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
  ];
  
  for (const format of formats) {
    const match = str.match(format);
    if (match) {
      if (format === formats[0]) return str;
      if (format === formats[1] || format === formats[2]) {
        return `${match[3]}-${match[2]}-${match[1]}`;
      }
    }
  }
  return new Date().toISOString().split('T')[0];
};

const MetricsUpload = ({ userId, onUploadComplete }: MetricsUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState<{ total: number; success: number } | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setIsUploading(true);
    setUploadStats(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as any[];
          const headers = Object.keys(rows[0] || {});
          const headerMap: Record<string, string> = {};
          headers.forEach(h => {
            headerMap[h] = normalizeHeader(h);
          });

          const metrics: ParsedMetric[] = rows.map(row => {
            const mapped: any = {};
            Object.entries(row).forEach(([key, value]) => {
              mapped[headerMap[key]] = value;
            });

            return {
              campaign_name: mapped.campaign_name || 'Sem Campanha',
              ad_set_name: mapped.ad_set_name || null,
              ad_name: mapped.ad_name || null,
              creative_name: mapped.creative_name || mapped.ad_name || null,
              date: parseDate(mapped.date),
              impressions: parseNumber(mapped.impressions),
              clicks: parseNumber(mapped.clicks),
              link_clicks: parseNumber(mapped.link_clicks || mapped.clicks),
              unique_link_clicks: parseNumber(mapped.unique_link_clicks),
              reach: parseNumber(mapped.reach),
              spend: parseNumber(mapped.spend),
              leads: parseNumber(mapped.leads),
              conversions: parseNumber(mapped.conversions || mapped.leads),
              ctr: parseNumber(mapped.ctr),
              cpc: parseNumber(mapped.cpc),
              cpm: parseNumber(mapped.cpm),
              cpl: parseNumber(mapped.cpl),
              frequency: parseNumber(mapped.frequency),
              thumbnail_url: mapped.thumbnail_url || null,
              channel: mapped.channel || 'meta',
            };
          }).filter(m => m.campaign_name);

          const dataToInsert = metrics.map(m => ({
            user_id: userId,
            ...m,
          }));

          const { error } = await supabase
            .from('campaign_metrics')
            .upsert(dataToInsert, { 
              onConflict: 'user_id,campaign_name,date',
              ignoreDuplicates: false 
            });

          if (error) throw error;

          setUploadStats({ total: rows.length, success: metrics.length });
          toast({
            title: "Upload concluído!",
            description: `${metrics.length} registros importados com sucesso.`,
          });
          onUploadComplete();
        } catch (error: any) {
          console.error("Erro no upload:", error);
          toast({
            title: "Erro",
            description: error.message || "Falha ao processar o arquivo.",
            variant: "destructive",
          });
        } finally {
          setIsUploading(false);
        }
      },
      error: (error) => {
        console.error("Erro ao parsear CSV:", error);
        toast({
          title: "Erro",
          description: "Não foi possível ler o arquivo.",
          variant: "destructive",
        });
        setIsUploading(false);
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    if (e.target) e.target.value = '';
  };

  return (
    <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 md:p-7 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase text-white tracking-widest flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-[#f90f54]" />
          Upload de Métricas
        </h3>
        {uploadStats && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUploadStats(null)}
            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {uploadStats ? (
        <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
          <CheckCircle2 className="w-5 h-5 text-green-400" />
          <div>
            <p className="text-sm font-medium text-green-400">Upload concluído!</p>
            <p className="text-xs text-slate-400">{uploadStats.success} de {uploadStats.total} registros importados</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            Faça upload de uma planilha CSV com métricas de campanhas. Colunas suportadas: Campaign Name, Spend, Impressions, Clicks, CTR, CPC, CPM, Leads, etc.
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full bg-gradient-to-r from-[#f90f54] to-[#8735d2] hover:opacity-90 text-white font-bold py-4 rounded-xl transition-all min-h-[44px] active:scale-95"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Selecionar Arquivo CSV
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default MetricsUpload;
