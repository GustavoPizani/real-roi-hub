import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface CampaignViewProps {
  data: any[];
  isLoading: boolean;
}

export const CampaignView = ({ data, isLoading }: CampaignViewProps) => {
  // Formata moeda (BRL)
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  // Formata número simples
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("pt-BR").format(value || 0);
  };

  if (isLoading) {
    return (
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Performance por Campanha</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-4 overflow-hidden">
      <CardHeader>
        <CardTitle>Performance por Campanha</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Campanha</TableHead>
                <TableHead className="text-right">Investimento</TableHead>
                <TableHead className="text-center">Leads</TableHead>
                <TableHead className="text-right">CPL</TableHead>
                <TableHead className="text-center">Cliques</TableHead>
                <TableHead className="text-right">CPC</TableHead>
                <TableHead className="text-right">CTR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma campanha encontrada neste período.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, index) => (
                  <TableRow key={index} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {row.campaign_name}
                    </TableCell>
                    <TableCell className="text-right font-bold text-[#f90f54]">
                      {formatCurrency(row.spend)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={row.leads > 0 ? "default" : "secondary"}>
                        {formatNumber(row.leads)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.cpl)}
                    </TableCell>
                    <TableCell className="text-center">
                      {formatNumber(row.clicks)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.cpc)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.ctr?.toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
