import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Lead {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  campanha_nome: string | null;
  situacao_atendimento: string | null;
  cadastro: string | null;
  fac_id: string | null;
}

interface CampaignData {
  campaignName: string;
}

interface LeadsTableProps {
  userId: string;
  refreshTrigger: number;
  campaigns: CampaignData[];
}

const ROWS_PER_PAGE = 10;

const LeadsTable = ({ userId, refreshTrigger, campaigns }: LeadsTableProps) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true);
      let query = supabase
        .from("crm_leads")
        .select("id, nome, email, telefone, campanha_nome, situacao_atendimento, cadastro, fac_id")
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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, campaignFilter, originFilter]);

  const filteredLeads = useMemo(() => {
    let tempLeads = [...leads];
    
    if (originFilter === 'synced') {
      // Sincronizados: fac_id NÃO começa com "ag:" E nome não é "Sem Nome" e não é vazio.
      tempLeads = tempLeads.filter(lead => 
        !lead.fac_id?.startsWith('ag:') && lead.nome && lead.nome !== 'Sem Nome'
      );
    } else if (originFilter === 'meta_only') {
      // Pendentes (Só na Meta): fac_id começa com "ag:" OU nome está "Sem Nome".
      tempLeads = tempLeads.filter(lead => 
        lead.fac_id?.startsWith('ag:') || lead.nome === 'Sem Nome'
      );
    }

    if (!searchTerm) return tempLeads;

    const lowercasedFilter = searchTerm.toLowerCase();
    return tempLeads.filter(
      (lead) =>
        lead.nome?.toLowerCase().includes(lowercasedFilter) ||
        lead.email?.toLowerCase().includes(lowercasedFilter) ||
        lead.telefone?.replace(/\D/g, '').includes(lowercasedFilter)
    );
  }, [leads, searchTerm, originFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredLeads.length / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = startIndex + ROWS_PER_PAGE;
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

  return (
    <div className="glass-card p-6">
      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <h2 className="text-xl font-semibold">Leads do CRM</h2>
        <div className="flex gap-2 w-full md:w-auto">
          <Input
            placeholder="Buscar por nome, email, telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-[250px] bg-surface-2"
          />
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="w-full md:w-[250px] bg-surface-2">
              <SelectValue placeholder="Filtrar por campanha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Campanhas</SelectItem>
              {(campaigns || []).filter(c => c.campaignName && c.campaignName.trim() !== "").map((c) => (
                <SelectItem key={c.campaignName} value={c.campaignName}>
                  {c.campaignName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={originFilter} onValueChange={setOriginFilter}>
            <SelectTrigger className="w-full md:w-[200px] bg-surface-2">
              <SelectValue placeholder="Filtrar por origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="synced">Sincronizados</SelectItem>
              <SelectItem value="meta_only">Apenas na Meta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Campanha</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data de Cadastro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : paginatedLeads.length > 0 ? (
              paginatedLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.nome || "Não informado"}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{lead.email}</span>
                      <span className="text-xs text-muted-foreground">{lead.telefone?.replace('p:+', '')}</span>
                    </div>
                  </TableCell>
                  <TableCell>{lead.campanha_nome}</TableCell>
                  <TableCell>{lead.situacao_atendimento}</TableCell>
                  <TableCell>
                    {lead.cadastro
                      ? format(new Date(lead.cadastro), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : "-"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  Nenhum lead encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {!loading && filteredLeads.length > 0 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Mostrando {startIndex + 1} a {Math.min(endIndex, filteredLeads.length)} de {filteredLeads.length} leads
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Página {currentPage} de {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              className="gap-1"
            >
              Próximo
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadsTable;