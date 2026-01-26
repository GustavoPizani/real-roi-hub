import { useState, useMemo } from "react";
import Sidebar from "@/components/dashboard/Sidebar"; 
import { MobileHeader } from "@/components/dashboard/MobileHeader";
import { useIsMobile } from "@/hooks/use-mobile";
import { CampaignView } from "@/components/dashboard/CampaignView";
import { CreativeView } from "@/components/dashboard/CreativeView";
import { OverviewView } from "@/components/dashboard/OverviewView";
import { PDFReportTemplate } from "@/components/dashboard/PDFReportTemplate";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDashboardData } from "@/hooks/useDashboardData";
import { addDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { TrendingUp, Filter, MessageSquare, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIChatPanel } from "@/components/dashboard/AIChatPanel";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const Dashboard = () => {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: addDays(new Date(), -30), to: new Date() });
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Agora recebemos 'allProjects' do hook
  const { data, creatives, dailyMetrics, rawMetrics, allProjects, isLoading, fetchDashboardData } = useDashboardData(dateRange, refreshTrigger);

  const handleRefresh = () => setRefreshTrigger(prev => prev + 1);

  // --- CORREÇÃO DO FILTRO ---
  // 1. LISTA DE OPÇÕES: Usa allProjects (que agora são Contas)
  const availableCampaigns = useMemo(() => {
    // Se temos a lista completa do banco, usamos ela.
    if (allProjects && allProjects.length > 0) {
        return allProjects;
    }
    // Fallback: tenta pegar account_name dos dados
    if (!data) return [];
    return Array.from(new Set(data.map(d => d.account_name).filter(Boolean))).sort();
  }, [allProjects, data]);

  // 2. FILTRAR CAMPANHAS: Compara 'account_name' com a seleção
  const filteredCampaigns = useMemo(() => {
    if (selectedCampaign === "all") return data;
    // MUDANÇA: Filtra onde a conta é igual a selecionada
    return data.filter(d => d.account_name === selectedCampaign);
  }, [data, selectedCampaign]);

  // 3. FILTRAR CRIATIVOS: Compara 'account_name'
  const filteredCreatives = useMemo(() => {
    if (selectedCampaign === "all") return creatives;
    return creatives.filter(c => c.account_name === selectedCampaign);
  }, [creatives, selectedCampaign]);

  // ... (o resto do dynamicChartData também deve filtrar por account_name se necessário)
  const dynamicChartData = useMemo(() => {
    const sourceData = selectedCampaign === "all" 
      ? rawMetrics 
      : rawMetrics.filter(m => m.account_name === selectedCampaign); // MUDANÇA AQUI TAMBÉM

    const groupedByDate: Record<string, any> = {};
    
    sourceData.forEach((item: any) => {
      const date = item.date;
      if (!groupedByDate[date]) {
        groupedByDate[date] = { date, spend: 0, leads: 0 };
      }
      groupedByDate[date].spend += Number(item.spend || 0);
      groupedByDate[date].leads += Number(item.leads || 0);
    });

    return Object.values(groupedByDate)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((d: any) => ({
        ...d,
        cpl: d.leads > 0 ? d.spend / d.leads : 0
      }));
  }, [rawMetrics, selectedCampaign]);

  const handleExportPDF = async () => {
    setIsExporting(true);
    toast({ title: "Preparando Relatório...", description: `Gerando relatório ${selectedCampaign !== 'all' ? 'personalizado' : 'completo'}.` });

    setTimeout(async () => {
      try {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const uniqueCampaignNames = Array.from(new Set(filteredCampaigns.map(d => d.campaign_name))).filter(Boolean);
        const totalPages = 1 + uniqueCampaignNames.length; 

        for (let i = 1; i <= totalPages; i++) {
          const element = document.getElementById(`report-page-${i}`);
          if (element) {
            const canvas = await html2canvas(element, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            if (i > 1) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
          }
        }

        const fileName = selectedCampaign === 'all' 
          ? `Relatorio_Geral_${new Date().toISOString().split('T')[0]}.pdf`
          : `Relatorio_${selectedCampaign.replace(/\s+/g, '_')}.pdf`;

        pdf.save(fileName);
        toast({ title: "Relatório Gerado!", description: "Download iniciado com sucesso." });

      } catch (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Erro", description: "Falha ao gerar o PDF." });
      } finally {
        setIsExporting(false);
      }
    }, 2000);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f172a] text-slate-200">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {isMobile && <MobileHeader />}
        
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
                    <SelectValue placeholder="Filtrar Conta" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1e293b] border-slate-700 text-white max-h-[400px] overflow-y-auto">
                    <SelectItem value="all">Todas as Contas</SelectItem>
                    {availableCampaigns.map((camp) => (
                      <SelectItem key={camp} value={camp}>{camp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleExportPDF} 
                  disabled={isExporting}
                  className={`border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-white ${isExporting ? 'animate-pulse' : ''}`}
                  title="Exportar PDF"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin text-[#f90f54]" /> : <Download className="h-4 w-4" />}
                </Button>

                <Button variant="outline" size="icon" onClick={handleRefresh} className="border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-white" title="Sincronizar Meta">
                  <TrendingUp className="h-4 w-4" />
                </Button>
                
                <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
                  <SheetTrigger asChild>
                    <Button variant="default" className="gap-2 bg-[#f90f54] hover:bg-[#f90f54]/90 shadow-lg shadow-[#f90f54]/20 border-none text-white font-bold">
                      <MessageSquare className="h-4 w-4" />
                      <span className="hidden md:inline">IA Analista</span>
                    </Button>
                  </SheetTrigger>
                  
                  <SheetContent className="w-full sm:max-w-md p-0 border-l border-slate-800 bg-[#0f172a] flex flex-col">
                      <SheetHeader className="p-4 border-b border-slate-800 bg-slate-900/50 text-left space-y-0">
                         <SheetTitle className="text-white text-base font-semibold flex items-center gap-2">
                            Assistente ROI
                         </SheetTitle>
                         <SheetDescription className="sr-only">
                            Chatbot de inteligência artificial para análise de marketing.
                         </SheetDescription>
                      </SheetHeader>
                      
                      <div className="flex-1 overflow-hidden">
                         <AIChatPanel />
                      </div>
                  </SheetContent>
                </Sheet>

             </div>
          </header>
        )}
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 bg-[#0f172a]">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="bg-slate-800/50 border border-slate-700/50">
              <TabsTrigger value="overview" className="data-[state=active]:bg-[#f90f54] data-[state=active]:text-white text-slate-400">Visão Geral</TabsTrigger>
              <TabsTrigger value="campaigns" className="data-[state=active]:bg-[#f90f54] data-[state=active]:text-white text-slate-400">Campanhas</TabsTrigger>
              <TabsTrigger value="creatives" className="data-[state=active]:bg-[#f90f54] data-[state=active]:text-white text-slate-400">Criativos</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <OverviewView 
                data={filteredCampaigns} 
                dailyData={dynamicChartData} 
                isLoading={isLoading} 
              />
            </TabsContent>

            <TabsContent value="campaigns" className="space-y-4">
              <CampaignView data={filteredCampaigns} isLoading={isLoading} />
            </TabsContent>

            <TabsContent value="creatives" className="space-y-4">
               <CreativeView creatives={filteredCreatives} isLoading={isLoading} />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {isExporting && (
        <div style={{ position: 'absolute', top: -9999, left: -9999 }}>
          <PDFReportTemplate data={filteredCampaigns} dateRange={dateRange} />
        </div>
      )}
    </div>
  );
};

export default Dashboard;