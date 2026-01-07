import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Facebook, RefreshCw, Loader2, Info, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

interface CampaignData {
  campaignName?: string;
  name?: string;
}

interface CRMUploadProps {
  userId: string;
  onUploadComplete: () => void;
  campaigns: CampaignData[];
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

// 1. NORMALIZAÇÃO AVANÇADA (BASEADA NO CSV DO META)
const normalizeLeadData = (row: any, campaignName: string, userId: string) => {
  const email = (row.email || row.Email || row['E-mail'] || "").toLowerCase().trim();
  const full_name = row.Nome || row.full_name || row.Cliente || "Sem Nome";
  const telefone = row['Seu melhor telefone'] || row.phone || row.Telefone || row.phone_number;
  
  // Extração de nomes para nota de qualidade 8.0+
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
    fac_id: row.id || row.ad_id || "", // Sobrescreve fac_id com ID real da Meta
    origem_importacao: 'facebook_csv',
    situacao_atendimento: 'Novo'
  };
};

const CRMUpload = ({ userId, onUploadComplete, campaigns }: CRMUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const facebookInputRef = useRef<HTMLInputElement>(null);
  const crmInputRef = useRef<HTMLInputElement>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");

  // 2. FUNÇÃO DE SINCRONIZAÇÃO MANUAL (CORRIGE O ERRO DE REFERENCE)
  const handleForceSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) throw new Error("Usuário não autenticado. Por favor, faça o login novamente.");

      let from = 0;
      const step = 100; // Lote de processamento
      let hasMore = true;
      let totalSincronizado = 0;

      toast({ title: "Sincronização Total", description: "Iniciando varredura completa da base..." });

      while (hasMore) {
        // Busca o lote atual
        const { data: leads, error } = await supabase
          .from('crm_leads')
          .select('*')
          .eq('user_id', userId)
          .range(from, from + step - 1);

        if (error) throw error;

        if (leads && leads.length > 0) {
          // Processa o lote atual
          const promises = leads.map(lead => 
            supabase.functions.invoke("facebook-capi", { 
              body: { record: lead },
              headers: {
                Authorization: `Bearer ${session.access_token}`
              }
            })
          );

          const results = await Promise.all(promises);
          
          results.forEach((res, index) => {
            const lead = leads[index];
            const { data, error } = res;
            if (error || (data && !data.success)) {
              console.group(`🚨 Erro no Lead: ${lead.email}`);
              console.error("Motivo da Meta:", data?.error_detail?.message || error?.message || "Erro de conexão");
              console.warn("Código do Erro:", data?.error_detail?.error_user_msg || "Verifique o formato dos dados");
              console.groupEnd();
            } else {
              console.log(`✅ [${totalSincronizado + index + 1}] Lead ${lead.email} Sincronizado!`);
            }
          });

          totalSincronizado += leads.length;
          from += step;

          if (leads.length < step) hasMore = false;
        } else {
          hasMore = false;
        }
      }

      toast({ 
        title: "Sucesso!", 
        description: `Sincronização completa: ${totalSincronizado} leads processados.`,
        variant: "default" 
      });

    } catch (err: any) {
      console.error("Erro na sincronização total:", err);
      toast({ title: "Erro na Sincronização", description: err.message, variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

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
    const delimiter = flow === 'facebook' ? '\t' : ','; // Detecta TAB para o CSV do Meta

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter,
      complete: async (results) => {
        try {
          if (flow === 'facebook') {
            const leadsParaSalvar = (results.data as any[])
              .filter((row: any) => row.email || row.Email || row.Nome)
              .map((row) => normalizeLeadData(row, selectedCampaign, userId));

            // REGRA: ignoreDuplicates: false para SOBRESCREVER dados baseados no e-mail
            const { error } = await supabase
              .from('crm_leads')
              .upsert(leadsParaSalvar, { 
                onConflict: 'user_id,email',
                ignoreDuplicates: false 
              });

            if (error) throw error;
            toast({ title: "Importação Concluída", description: "Dados atualizados com sucesso." });
          } else {
            // --- FLUXO CRM: SINCRONIZAÇÃO COM LOG DE AUDITORIA ---
            const crmRows = results.data as any[];
            console.log("📊 Iniciando processamento de", crmRows.length, "linhas do CSV.");
            
            // 1. Buscar leads existentes para validar a Regra 2
            let allExistingEmails: string[] = [];
            let from = 0;
            let step = 1000;
            let hasMore = true;

            console.log("⏳ Buscando base completa de leads...");

            while (hasMore) {
              const { data: batch, error: fetchError } = await supabase
                .from('crm_leads')
                .select('email')
                .eq('user_id', userId)
                .range(from, from + step - 1);

              if (fetchError) {
                console.error("❌ Erro na busca em lote:", fetchError);
                break;
              }

              if (batch && batch.length > 0) {
                const batchEmails = batch.map(l => l.email?.toLowerCase()?.trim()).filter(Boolean);
                allExistingEmails = [...allExistingEmails, ...batchEmails];
                
                if (batch.length < step) {
                  hasMore = false;
                } else {
                  from += step;
                }
              } else {
                hasMore = false;
              }
            }

            const existingEmails = new Set(allExistingEmails);

            // Log de verificação em tempo real
            const emailBusca = "pedronetopsh@gmail.com";
            console.log(`🔎 Total carregado do banco: ${existingEmails.size}`);
            console.log(`🎯 O Pedro está na lista de busca? ${existingEmails.has(emailBusca)}`)

            const stats = { atualizados: 0, novasVendas: 0, descartadosFinalizado: 0, ignoradosNaoExistem: 0 };

            const leadsParaProcessar = crmRows.map((row, index) => {
              const email = (row.Email || row.email || row['E-mail'])?.trim()?.toLowerCase();
              const nome = row.Cliente || row.nome || row.Nome || row.full_name;
              
              // Captura da situação e status conforme seu CSV (Listagem de Fac (16))
              const situacaoCrm = (row['Situação'] || row.situacao || "").trim();
              const statusBruto = row['Situação Atendimento'] || row.situacao_atendimento || row.Status;
              const statusMapeado = mapStatusToMeta(statusBruto);

              if (!email) return null;

              // REGRA 1: Descarte de Finalizados
              if (situacaoCrm === "Atendimento Finalizado") {
                stats.descartadosFinalizado++;
                return null;
              }

              const jaExiste = existingEmails.has(email);
              const isVenda = statusMapeado === "Purchase";

              if (jaExiste || isVenda) {
                if (jaExiste) stats.atualizados++;
                else stats.novasVendas++;

                // LOG DE SUCESSO NO MAPEAMENTO (Para conferir se 'Visita' virou 'Schedule')
                console.log(`✅ [Linha ${index + 1}] Processando: ${email} | Status Origem: "${statusBruto}" -> Mapeado: ${statusMapeado}`);
                
                return {
                  user_id: userId,
                  email: email,
                  nome: nome,
                  situacao_atendimento: statusMapeado,
                  campanha_nome: selectedCampaign,
                };
              }

              stats.ignoradosNaoExistem++;
              return null;
            }).filter(Boolean);

            // RESUMO FINAL NO CONSOLE
            console.table({
              "Total no CSV": crmRows.length,
              "Atualizados": stats.atualizados,
              "Novas Vendas Inseridas": stats.novasVendas,
              "Descartados (Finalizados)": stats.descartadosFinalizado,
              "Ignorados (Não existem no banco)": stats.ignoradosNaoExistem,
              "Total Enviado ao Supabase": leadsParaProcessar.length
            });

            if (leadsParaProcessar.length === 0) {
              toast({ title: "Processamento concluído", description: "Nenhuma atualização necessária ou leads novos sem status de Venda ignorados." });
              setIsUploading(false);
              return;
            }

            const { error } = await supabase
              .from('crm_leads')
              .upsert(leadsParaProcessar, { onConflict: 'user_id,email' });

            if (error) throw error;
            toast({ title: "Sincronização OK", description: "Dados atualizados conforme regras de conversão." });
          }
          onUploadComplete();
        } catch (error: any) {
          toast({ title: "Erro no processamento", description: error.message, variant: "destructive" });
        } finally {
          setIsUploading(false);
        }
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header com Botão de Force Sync */}
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
          <p className="text-xs text-slate-400 mb-8 leading-relaxed font-medium">Importe o CSV bruto da Meta. O sistema irá atualizar dados existentes baseando-se no e-mail.</p>
          
          <input type="file" accept=".csv" ref={facebookInputRef} onChange={(e) => handleFileSelect(e, 'facebook')} className="hidden" />
          <Button 
            onClick={() => facebookInputRef.current?.click()} 
            disabled={!selectedCampaign || isUploading}
            className="w-full h-14 bg-[#0f172a] hover:bg-[#f90f54] text-white border border-slate-700 font-black rounded-xl transition-all uppercase tracking-widest text-xs"
          >
            {isUploading ? <Loader2 className="animate-spin" /> : <Upload className="w-4 h-4 mr-2" />} Subir CSV Facebook
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
          <p className="text-xs text-slate-400 mb-8 leading-relaxed font-medium">Atualize os status das Facs para alimentar o Funil de Vendas e o cálculo de ROI Real.</p>
          
          <input type="file" accept=".csv" ref={crmInputRef} onChange={(e) => handleFileSelect(e, 'crm')} className="hidden" />
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