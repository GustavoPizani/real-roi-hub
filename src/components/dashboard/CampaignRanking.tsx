import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

interface AdData {
  id: string;
  name: string;
  impressions: number;
  clicks: number;
  spend: number;
  realLeads?: number;
  thumbnail_url?: string;
}

interface CampaignData {
  campaignName: string;
  ads: AdData[];
  totalSpend: number;
  totalLeads: number;
}

interface CampaignRankingProps {
  campaigns: CampaignData[];
  title: string;
}

const CampaignRanking = ({ campaigns, title }: CampaignRankingProps) => {
  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="glass-card p-6">
        <h3 className="font-semibold mb-4">{title}</h3>
        <p className="text-sm text-muted-foreground text-center py-8">Sem dados de campanha para exibir.</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold">{title}</h3>
      </div>
      <Accordion type="single" collapsible className="w-full">
        {campaigns.sort((a, b) => b.totalLeads - a.totalLeads).map((campaign) => (
          <AccordionItem value={campaign.campaignName} key={campaign.campaignName} className="border-b border-border/50">
            <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
              <div className="flex justify-between items-center w-full">
                <span className="font-medium text-left">{campaign.campaignName}</span>
                <div className="flex gap-4 text-right">
                  <div className="w-28">
                    <p className="text-xs text-muted-foreground">Gasto</p>
                    <p>R$ {campaign.totalSpend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="w-28">
                    <p className="text-xs text-muted-foreground">Leads</p>
                    <p>{campaign.totalLeads}</p>
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="bg-muted/20">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-0">
                      <TableHead className="w-[60%]">Anúncio</TableHead>
                      <TableHead>Gasto</TableHead>
                      <TableHead>Leads (CRM)</TableHead>
                      <TableHead>CPR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaign.ads.sort((a, b) => (b.realLeads || 0) - (a.realLeads || 0)).map((ad) => (
                      <TableRow key={ad.id} className="border-border/50">
                        <TableCell className="font-medium flex items-center gap-3">
                          {ad.thumbnail_url && (
                            <img src={ad.thumbnail_url} alt={ad.name} className="w-10 h-10 rounded-md object-cover" />
                          )}
                          <span>{ad.name}</span>
                        </TableCell>
                        <TableCell>R$ {ad.spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>{ad.realLeads || 0}</TableCell>
                        <TableCell>
                          {ad.realLeads && ad.realLeads > 0
                            ? `R$ ${(ad.spend / ad.realLeads).toFixed(2)}`
                            : 'R$ 0.00'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default CampaignRanking;
