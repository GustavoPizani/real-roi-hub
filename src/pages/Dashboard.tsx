import { useState, useMemo } from "react";
import Sidebar from "@/components/dashboard/Sidebar"; 
import { MobileHeader } from "@/components/dashboard/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import { CampaignView } from "@/components/dashboard/CampaignView";
import { CreativeView } from "@/components/dashboard/CreativeView";
import { OverviewView } from "@/components/dashboard/OverviewView";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboardData } from "@/hooks/useDashboardData";
import { addDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { TrendingUp, Filter, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIChatPanel } from "@/components/dashboard/AIChatPanel";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Dashboard = () => {
  const isMobile = useIsMobile();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Hook retorna 'creatives' para a aba de Criativos e 'data' para as outras
  const { data, creatives, isLoading, fetchDashboardData } = useDashboardData(dateRange, refreshTrigger);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const availableCampaigns = useMemo(() => {
    if (!data) return [];
    const campaigns = new Set(data.map(d => d.campaign_name).filter(Boolean));
    return Array.from(campaigns);
  }, [data]);

  // Filtro de Campanhas (Afeta Tabela e Visão Geral)
  const filteredCampaigns = useMemo(() => {
    if (selectedCampaign === "all") return data;
    return data.filter(d => d.campaign_name === selectedCampaign);
  }, [data, selectedCampaign]);

  // Filtro de Criativos (Afeta aba Criativos)
  const filteredCreatives = useMemo(() => {
    if (selectedCampaign === "all") return creatives;
    return creatives.filter(c => c.campaign_name === selectedCampaign);
  }, [creatives, selectedCampaign]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f172a] text-slate-200">
      <Sidebar />
      
      <div className="flex flex-1 flex-col overflow-hidden">
        {isMobile && <MobileHeader />}
        
        {/* Cabeçalho Desktop */}
        {!isMobile && (
          <header className="h-20 flex-shrink-0 flex items-center justify-between px-8 border-b border-slate-800/50 bg-[#0f172a]/80 backdrop-blur-xl z-20">
             <div>
               <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
               <p className="text-slate-400">Visão estratégica dos seus resultados.</p>
             </div>
             <div className="flex items-center gap-4">
                <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger className="w-[200px] bg-[#1e293b] border-slate-700 text-white">
                    <Filter className="w-4 h-4 mr-2 text-slate-400" />
                    <SelectValue placeholder="Filtrar Projeto" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1e293b] border-slate-700 text-white">
                    <SelectItem value="all">Todos os Projetos</SelectItem>
                    {availableCampaigns.map((camp) => (
                      <SelectItem key={camp} value={camp}>{camp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="outline" size="icon" onClick={handleRefresh} title="Atualizar" className="border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-white">
                  <TrendingUp className="h-4 w-4" />
                </Button>

                <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
                  <SheetTrigger asChild>
                    <Button variant="default" className="gap-2 bg-[#f90f54] hover:bg-[#f90f54]/90 shadow-lg shadow-[#f90f54]/20 border-none text-white font-bold">
                      <MessageSquare className="h-4 w-4" />
                      <span className="hidden md:inline">IA Analista</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-md p-0 border-l border-slate-800 bg-[#0f172a]">
                     <div className="h-full flex flex-col">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                          <h3 className="font-semibold flex items-center gap-2 text-white">
                            <MessageSquare className="w-4 h-4 text-[#f90f54]" /> 
                            Assistente ROI
                          </h3>
                          <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(false)} className="text-slate-400 hover:text-white">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <AIChatPanel /> 
                        </div>
                     </div>
                  </SheetContent>
                </Sheet>
             </div>
          </header>
        )}
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 bg-[#0f172a]">
          
          {/* Abas com Estilo Dark/Neon */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="bg-slate-800/50 border border-slate-700/50">
              <TabsTrigger value="overview" className="data-[state=active]:bg-[#f90f54] data-[state=active]:text-white text-slate-400">Visão Geral</TabsTrigger>
              <TabsTrigger value="campaigns" className="data-[state=active]:bg-[#f90f54] data-[state=active]:text-white text-slate-400">Campanhas</TabsTrigger>
              <TabsTrigger value="creatives" className="data-[state=active]:bg-[#f90f54] data-[state=active]:text-white text-slate-400">Criativos</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <OverviewView data={filteredCampaigns} isLoading={isLoading} />
            </TabsContent>

            <TabsContent value="campaigns" className="space-y-4">
              <CampaignView data={filteredCampaigns} isLoading={isLoading} />
            </TabsContent>

            <TabsContent value="creatives" className="space-y-4">
               {/* Usando a lista de criativos filtrada */}
               <CreativeView creatives={filteredCreatives} isLoading={isLoading} />
            </TabsContent>
          </Tabs>

        </main>
      </div>
    </div>
  );
};

export default Dashboard;