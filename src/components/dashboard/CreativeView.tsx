import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageIcon, Video, Megaphone } from "lucide-react";

interface CreativeViewProps {
  creatives: any[];
  isLoading: boolean;
}

export const CreativeView = ({ creatives, isLoading }: CreativeViewProps) => {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="p-0"><Skeleton className="h-[200px] w-full rounded-t-lg" /></CardHeader>
            <CardContent className="p-4 space-y-2"><Skeleton className="h-4 w-full" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!creatives || creatives.length === 0) {
    return (
      <Card className="col-span-full border-dashed border-slate-800 bg-[#1e293b]/20">
        <CardContent className="flex flex-col items-center justify-center py-12 text-slate-500">
          <ImageIcon className="w-12 h-12 mb-3 opacity-20" />
          <p>Nenhum criativo encontrado com os filtros atuais.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {creatives.map((ad, index) => (
        <Card key={index} className="overflow-hidden hover:shadow-lg hover:shadow-[#f90f54]/10 transition-all border-slate-800 bg-[#1e293b]/40 backdrop-blur-sm group">
          <div className="relative">
            <AspectRatio ratio={1}>
              {ad.thumbnail_url ? (
                <img 
                  src={ad.thumbnail_url} 
                  alt={ad.ad_name} 
                  className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105" 
                />
              ) : (
                <div className="w-full h-full bg-slate-900/50 flex items-center justify-center border-b border-slate-800">
                  <ImageIcon className="w-10 h-10 text-slate-700" />
                </div>
              )}
            </AspectRatio>
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="bg-black/70 text-white backdrop-blur-md border-none px-2 py-1">
                {ad.ad_name?.toLowerCase().includes("vídeo") ? <Video className="w-3 h-3 mr-1 text-[#f90f54]" /> : <ImageIcon className="w-3 h-3 mr-1 text-[#f90f54]" />}
                {/* Fallback para mostrar 'Meta' se não tiver channel */}
                <span className="text-[10px] font-bold uppercase tracking-wider">{ad.channel || "Meta"}</span>
              </Badge>
            </div>
          </div>
          
          <CardHeader className="p-4 pb-3 space-y-1">
            {/* Nome do Anúncio */}
            <CardTitle className="text-sm font-bold text-white line-clamp-1" title={ad.ad_name}>
              {ad.ad_name || "Anúncio sem nome"}
            </CardTitle>
            
            {/* NOVO: Nome da Campanha */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400" title={ad.campaign_name}>
              <Megaphone className="w-3 h-3 text-slate-500 shrink-0" />
              <span className="truncate">{ad.campaign_name || "Campanha Desconhecida"}</span>
            </div>
          </CardHeader>
          
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-2 gap-2 text-xs mt-2">
              <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Investido</span>
                <span className="font-bold text-[#f90f54] text-sm">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ad.spend || 0)}
                </span>
              </div>
              <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-0.5">Leads</span>
                <span className="font-bold text-white text-sm">{ad.leads || 0}</span>
              </div>
              <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-0.5">CPL</span>
                <span className="font-bold text-slate-300">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ad.cpl || 0)}
                </span>
              </div>
              <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-0.5">CTR</span>
                <span className="font-bold text-slate-300">{ad.ctr ? ad.ctr.toFixed(2) : 0}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};