import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadCardProps {
  lead: {
    id: string;
    nome: string | null;
    email: string | null;
    telefone: string | null;
    campanha_nome: string | null;
    situacao_atendimento: string | null;
    cadastro: string | null;
    fac_id: string | null;
    updated_at: string | null;
  };
}

const getStatusBadgeVariant = (status: string | null): string => {
  const s = status?.toLowerCase() || 'lead';
  if (s.includes('purchase')) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (s.includes('submitapplication')) return 'bg-primary/20 text-primary border-primary/30';
  if (s.includes('schedule')) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  if (s.includes('contact')) return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  return 'bg-muted text-muted-foreground border-muted-foreground/30';
};

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

const LeadCard = ({ lead }: LeadCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-[#1e293b]/60 backdrop-blur-md border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between text-left min-h-[64px] active:bg-slate-800/30 transition-colors"
      >
        <div className="flex-1 min-w-0 mr-3">
          <p className="font-medium text-sm text-slate-200 truncate">
            {lead.email || "Sem email"}
          </p>
          <Badge 
            variant="outline" 
            className={`font-normal text-[10px] mt-1 ${getStatusBadgeVariant(lead.situacao_atendimento)}`}
          >
            {lead.situacao_atendimento || 'Lead'}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-700/50 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Nome</p>
              <p className="text-sm text-slate-300">{lead.nome || "Não informado"}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Telefone</p>
              <p className="text-sm text-slate-300">{lead.telefone?.replace('p:+', '') || "-"}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Campanha</p>
              <p className="text-sm text-slate-300 truncate">{lead.campanha_nome || "-"}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Cadastro</p>
              <p className="text-sm text-slate-300">
                {lead.cadastro ? format(new Date(lead.cadastro), "dd/MM/yyyy", { locale: ptBR }) : "-"}
              </p>
            </div>
          </div>
          {lead.updated_at && (
            <p className="text-[10px] text-slate-500">
              Última atualização: {formatRelativeDate(lead.updated_at)}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default LeadCard;
