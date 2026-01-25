import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Ad {
  id: string;
  name: string;
  thumbnail?: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number; // Changed from conversions
  cpl: number; // Added cpl
}

interface AdsTableProps {
  ads: Ad[];
  title: string;
}

const AdsTable = ({ ads, title }: AdsTableProps) => {
  return (
    <div className="chart-container">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Criativo</TableHead>
              <TableHead className="text-muted-foreground text-right">Impressões</TableHead>
              <TableHead className="text-muted-foreground text-right">Cliques</TableHead>
              <TableHead className="text-muted-foreground text-right">Gasto</TableHead>
              <TableHead className="text-muted-foreground text-right">Leads</TableHead>
              <TableHead className="text-muted-foreground text-right">CPR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ads.map((ad, index) => (
              <TableRow 
                key={ad.id} 
                className="border-border hover:bg-muted/50 transition-colors animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                      {ad.thumbnail ? (
                        <img src={ad.thumbnail} alt={ad.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-muted-foreground">AD</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{ad.name}</p>
                      <Badge variant="secondary" className="text-xs mt-1">
                        #{index + 1}
                      </Badge>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {ad.impressions.toLocaleString('pt-BR')}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {ad.clicks.toLocaleString('pt-BR')}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  R$ {ad.spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-right">
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                    {ad.leads}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm text-primary">
                  R$ {ad.cpl.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdsTable;
