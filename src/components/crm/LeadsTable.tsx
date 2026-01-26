import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import LeadCard from "./LeadCard";

interface Lead {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  campanha_nome: string | null;
  situacao_atendimento: string | null;
  cadastro: string | null;
  fac_id: string | null;
  updated_at: string | null;
}

interface CampaignData {
  campaignName: string;
}

interface LeadsTableProps {
  userId: string;
  refreshTrigger: number;
  filterCampaign: string;
  setFilterCampaign: (value: string) => void;
  sortOrder: "asc" | "desc";
  campaigns: CampaignData[];
}

const STATUS_PRIORITY: Record<string, number> = {
  'purchase': 1,
  'submitapplication': 2,
  'schedule': 3,
  'contact': 4,
  'lead': 5,
  'novo': 6
};

const getStatusBadgeVariant = (status: string | null): string => {
  const s = status?.toLowerCase() || 'lead';
  if (s.includes('purchase')) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (s.includes('submitapplication')) return 'bg-primary/20 text-primary border-primary/30';
  if (s.includes('schedule')) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  if (s.includes('contact')) return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  return 'bg-muted text-muted-foreground border-muted-foreground/30';
};

const StatusBadge = ({ status }: { status: string | null }) => (
  <Badge 
    variant="outline" 
    className={`font-normal ${getStatusBadgeVariant(status)}`}
  >
    {status || 'Lead'}
  </Badge>
);

const formatRelativeDate = (dateString: string | null): string => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isToday(date)) return `Hoje às ${format(date, 'HH:mm')}`;
    if (isYesterday(date)) return 'Ontem';
    return format(date, 'dd/MM/yyyy');
  } catch {
    return "-";
  }
};

const LeadsTable = ({ userId, refreshTrigger, filterCampaign, setFilterCampaign, sortOrder, campaigns }: LeadsTableProps) => {
  const isMobile = useIsMobile();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [originFilter, setOriginFilter] = useState("all");
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10); 

  useEffect(() => {
    const fetchLeads = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        let query = supabase
          .from("crm_leads")
          .select("*")
          .eq("user_id", userId);

        if (filterCampaign !== "all") {
          query = query.eq("campanha_nome", filterCampaign);
        }

        // Ordenação por DATA (META) conforme solicitado para auditoria
        const { data, error } = await query.order("cadastro", { ascending: sortOrder === 'asc' });

        if (error) throw error;
        setLeads(data as Lead[]);
      } catch (error) {
        console.error("Error fetching leads:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, [userId, refreshTrigger, filterCampaign, sortOrder]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCampaign, originFilter, rowsPerPage]);

  const filteredLeads = useMemo(() => {
    let tempLeads = [...leads];

    if (originFilter === 'synced') {
      tempLeads = tempLeads.filter(lead => 
        !lead.fac_id?.startsWith('ag:') && lead.nome && lead.nome !== 'Sem Nome'
      );
    } else if (originFilter === 'meta_only') {
      tempLeads = tempLeads.filter(lead => 
        lead.fac_id?.startsWith('ag:') || lead.nome === 'Sem Nome'
      );
    }

    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      tempLeads = tempLeads.filter(
        (lead) =>
          lead.nome?.toLowerCase().includes(lowercasedFilter) ||
          lead.email?.toLowerCase().includes(lowercasedFilter) ||
          lead.telefone?.replace(/\D/g, '').includes(lowercasedFilter)
      );
    }

    // Apenas aplica priorização se não estiver em "Modo Auditoria" (se o sortOrder for padrão desc)
    // Se o usuário clicar para ordenar por data, respeitamos a data.
    return tempLeads;
  }, [leads, searchTerm, originFilter]);

  const totalPages = Math.ceil(filteredLeads.length / rowsPerPage);
  const currentLeads = filteredLeads.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  return (
    <div className="glass-card p-4 md:p-6 bg-slate-900/40 border border-slate-800 rounded-xl">
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-semibold text-white">Leads do CRM</h2>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3">
          <Input
            placeholder="Buscar por nome, email, telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-[250px] bg-[#0f172a] border-slate-700 text-white min-h-[44px]"
          />
          
          <Select value={filterCampaign} onValueChange={setFilterCampaign}>
            <SelectTrigger className="w-full md:w-[250px] bg-[#0f172a] border-slate-700 text-white min-h-[44px]">
              <SelectValue placeholder="Filtrar por campanha" />
            </SelectTrigger>
            <SelectContent className="bg-[#1e293b] border-slate-700 text-white">
              <SelectItem value="all">Todas as Campanhas</SelectItem>
              {(campaigns || []).filter(c => c.campaignName).map((c) => (
                <SelectItem key={c.campaignName} value={c.campaignName}>
                  {c.campaignName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={originFilter} onValueChange={setOriginFilter}>
            <SelectTrigger className="w-full md:w-[200px] bg-[#0f172a] border-slate-700 text-white min-h-[44px]">
              <SelectValue placeholder="Filtrar por origem" />
            </SelectTrigger>
            <SelectContent className="bg-[#1e293b] border-slate-700 text-white">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="synced">Sincronizados</SelectItem>
              <SelectItem value="meta_only">Apenas na Meta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#f90f54] animate-spin" />
        </div>
      ) : isMobile ? (
        <div className="space-y-3">
          {currentLeads.length > 0 ? (
            currentLeads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))
          ) : (
            <div className="text-center py-10 text-slate-500">Nenhum lead encontrado.</div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <Table>
            <TableHeader className="bg-slate-900/60">
              <TableRow className="border-slate-800">
                <TableHead className="text-slate-400">Cliente</TableHead>
                <TableHead className="text-slate-400">Contato</TableHead>
                <TableHead className="text-slate-400">Campanha</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Data Cadastro</TableHead>
                <TableHead className="text-slate-400 text-right">Última Att.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentLeads.length > 0 ? (
                currentLeads.map((lead) => (
                  <TableRow key={lead.id} className="border-slate-800 hover:bg-white/5 transition-colors">
                    <TableCell className="font-medium text-slate-200">{lead.nome || "Não informado"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-300">{lead.email}</span>
                        <span className="text-xs text-slate-500">{lead.telefone}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-400">{lead.campanha_nome}</TableCell>
                    <TableCell><StatusBadge status={lead.situacao_atendimento} /></TableCell>
                    <TableCell className="text-sm text-slate-300">
                      {lead.cadastro ? format(new Date(lead.cadastro), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-right">
                      {lead.updated_at ? (
                        <span className={isToday(new Date(lead.updated_at)) ? "text-emerald-400" : "text-slate-500"}>
                          {formatRelativeDate(lead.updated_at)}
                        </span>
                      ) : "-"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-slate-500">Nenhum lead encontrado.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-4 border-t border-slate-800 gap-4 mt-4">
        <p className="text-sm text-slate-500">
          Mostrando {currentLeads.length} de {filteredLeads.length} leads
        </p>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Linhas:</span>
            <Select value={rowsPerPage.toString()} onValueChange={(val) => setRowsPerPage(Number(val))}>
              <SelectTrigger className="h-8 w-[70px] bg-[#0f172a] border-slate-700 text-xs text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1e293b] border-slate-700 text-white">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-slate-700 text-white"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-300">Pág {currentPage} / {totalPages || 1}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-slate-700 text-white"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || loading || totalPages === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadsTable;