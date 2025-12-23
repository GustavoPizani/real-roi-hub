import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Lead {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  empreendimento: string | null;
  situacao_atendimento: string | null;
  canal: string | null;
  cadastro: string | null;
  atualizacao: string | null;
}

interface LeadsTableProps {
  userId: string;
  refreshTrigger?: number;
}

const LeadsTable = ({ userId, refreshTrigger }: LeadsTableProps) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeads();
  }, [userId, refreshTrigger]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("crm_leads")
        .select("*")
        .eq("user_id", userId)
        .order("cadastro", { ascending: false })
        .limit(50);

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error loading leads:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSituacaoBadge = (situacao: string | null) => {
    if (!situacao) return <Badge variant="secondary">-</Badge>;
    
    const lower = situacao.toLowerCase();
    if (lower.includes("venda") || lower.includes("fechado")) {
      return <Badge className="bg-neon-green/20 text-neon-green border-neon-green/30">{situacao}</Badge>;
    }
    if (lower.includes("qualificado") || lower.includes("negociação")) {
      return <Badge className="bg-primary/20 text-primary border-primary/30">{situacao}</Badge>;
    }
    if (lower.includes("perdido") || lower.includes("cancelado")) {
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30">{situacao}</Badge>;
    }
    return <Badge variant="secondary">{situacao}</Badge>;
  };

  if (loading) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Carregando leads...</p>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-muted-foreground">Nenhum lead encontrado. Faça upload de um CSV para começar.</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold">Leads Recentes</h3>
        <p className="text-sm text-muted-foreground">{leads.length} leads encontrados</p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Nome</TableHead>
              <TableHead className="text-muted-foreground">Email</TableHead>
              <TableHead className="text-muted-foreground">Empreendimento</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Canal</TableHead>
              <TableHead className="text-muted-foreground">Cadastro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead, index) => (
              <TableRow
                key={lead.id}
                className="border-border hover:bg-muted/50 transition-colors animate-fade-in"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <TableCell className="font-medium">{lead.nome || "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{lead.email || "-"}</TableCell>
                <TableCell className="text-sm">{lead.empreendimento || "-"}</TableCell>
                <TableCell>{getSituacaoBadge(lead.situacao_atendimento)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{lead.canal || "-"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {lead.cadastro
                    ? format(new Date(lead.cadastro), "dd/MM/yyyy", { locale: ptBR })
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default LeadsTable;
