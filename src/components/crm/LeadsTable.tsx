import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  campaigns: CampaignData[];
}

const STATUS_PRIORITY: Record<string, number> = {
  'purchase': 1,           // Prioridade Máxima
  'submitapplication': 2,
  'schedule': 3,
  'contact': 4,
  'lead': 5,               // Prioridade Padrão
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

const LeadsTable = ({ userId, refreshTrigger, campaigns }: LeadsTableProps) => {
  const isMobile = useIsMobile();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10); 

  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true);
      let query = supabase
        .from("crm_leads")
        .select("id, nome, email, telefone, campanha_nome, situacao_atendimento, cadastro, fac_id, updated_at")
        .eq("user_id", userId)
        .order("cadastro", { ascending: false });

      if (campaignFilter !== "all") {
        query = query.eq("campanha_nome", campaignFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching leads:", error);
      } else {
        setLeads(data as Lead[]);
      }
      setLoading(false);
    };

    if (userId) {
      fetchLeads();
    }
  }, [userId, refreshTrigger, campaignFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, campaignFilter, originFilter, rowsPerPage]);

  const filteredLeads = useMemo(() => {
    let tempLeads = [...leads];

    // 1. Filtros de Origem (Mantidos)
    if (originFilter === 'synced') {
      tempLeads = tempLeads.filter(lead => 
        !lead.fac_id?.startsWith('ag:') && lead.nome && lead.nome !== 'Sem Nome'
      );
    } else if (originFilter === 'meta_only') {
      tempLeads = tempLeads.filter(lead => 
        lead.fac_id?.startsWith('ag:') || lead.nome === 'Sem Nome'
      );
    }

    // 2. Filtro de Busca (Mantido)
    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      tempLeads = tempLeads.filter(
        (lead) =>
          lead.nome?.toLowerCase().includes(lowercasedFilter) ||
          lead.email?.toLowerCase().includes(lowercasedFilter) ||
          lead.telefone?.replace(/\D/g, '').includes(lowercasedFilter)
      );
    }

    // 3. LOGICA DE PRIORIZAÇÃO
    return tempLeads.sort((a, b) => {
      const statusA = a.situacao_atendimento?.toLowerCase() || 'lead';
      const statusB = b.situacao_atendimento?.toLowerCase() || 'lead';

      const priorityA = STATUS_PRIORITY[statusA] || 99;
      const priorityB = STATUS_PRIORITY[statusB] || 99;

      // Se as prioridades forem diferentes, ordena pelo peso (menor número primeiro)
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Se o status for o mesmo, mantém a ordem cronológica (mais novos primeiro)
      const dateA = a.cadastro ? new Date(a.cadastro).getTime() : 0;
      const dateB = b.cadastro ? new Date(b.cadastro).getTime() : 0;
      return dateB - dateA;
    });
  }, [leads, searchTerm, originFilter]);

  const totalPages = Math.ceil(filteredLeads.length / rowsPerPage);
  const currentLeads = filteredLeads.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  return (
    <div className="glass-card p-4 md:p-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-semibold">Leads do CRM</h2>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3">
          <Input
            placeholder="Buscar por nome, email, telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-[250px] bg-surface-2 min-h-[44px]"
          />
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="w-full md:w-[250px] bg-surface-2 min-h-[44px]">
              <SelectValue placeholder="Filtrar por campanha" />
            </SelectTrigger>
            <SelectContent className="bg-[#1e293b] border-slate-700">
              <SelectItem value="all">Todas as Campanhas</SelectItem>
              {(campaigns || []).filter(c => c.campaignName && c.campaignName.trim() !== "").map((c) => (
                <SelectItem key={c.campaignName} value={c.campaignName}>
                  {c.campaignName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={originFilter} onValueChange={setOriginFilter}>
            <SelectTrigger className="w-full md:w-[200px] bg-surface-2 min-h-[44px]">
              <SelectValue placeholder="Filtrar por origem" />
            </SelectTrigger>
            <SelectContent className="bg-[#1e293b] border-slate-700">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="synced">Sincronizados</SelectItem>
              <SelectItem value="meta_only">Apenas na Meta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content - Cards on Mobile, Table on Desktop */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : isMobile ? (
        /* Mobile: Expandable Cards */
        <div className="space-y-3">
          {currentLeads.length > 0 ? (
            currentLeads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              Nenhum lead encontrado.
            </div>
          )}
        </div>
      ) : (
        /* Desktop: Table */
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data de Cadastro</TableHead>
                <TableHead>Última Att.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentLeads.length > 0 ? (
                currentLeads.map((lead) => (
                  <TableRow key={lead.id} className="hover:bg-white/5 transition-colors">
                    <TableCell className="font-medium">{lead.nome || "Não informado"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{lead.email}</span>
                        <span className="text-xs text-muted-foreground">{lead.telefone?.replace('p:+', '')}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{lead.campanha_nome}</TableCell>
                    <TableCell><StatusBadge status={lead.situacao_atendimento} /></TableCell>
                    <TableCell className="text-sm">
                      {lead.cadastro
                        ? format(new Date(lead.cadastro), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lead.updated_at ? (
                        <span className={isToday(new Date(lead.updated_at)) ? "text-emerald-400 font-medium" : "text-muted-foreground"}>
                          {formatRelativeDate(lead.updated_at)}
                        </span>
                      ) : "-"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Nenhum lead encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between px-2 py-4 border-t border-border gap-4 mt-4">
        <div className="flex items-center gap-4">
          {!loading && (
            <p className="text-sm text-muted-foreground whitespace-nowrap">
              Mostrando {currentLeads.length} de {filteredLeads.length} leads
            </p>
          )}
          
          {!isMobile && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Linhas:</span>
              <Select 
                value={rowsPerPage.toString()} 
                onValueChange={(val) => setRowsPerPage(Number(val))}
              >
                <SelectTrigger className="h-8 w-[70px] bg-surface-2 text-xs">
                  <SelectValue placeholder={rowsPerPage} />
                </SelectTrigger>
                <SelectContent className="bg-[#1e293b] border-slate-700">
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 md:h-8 md:w-8 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center px-4 text-sm font-medium">
            Página {currentPage} de {totalPages || 1}
          </div>
          
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 md:h-8 md:w-8 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages || loading || totalPages === 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LeadsTable;
