import { useState, useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DateRange } from "react-day-picker";
import { subDays } from "date-fns";
import { FileDown, Zap, Loader2, MessageSquare, BrainCircuit, CalendarDays, Users, Target, LayoutDashboard, BarChart3, Image } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import Sidebar from "@/components/dashboard/Sidebar";
import BottomNav from "@/components/dashboard/BottomNav";
import MobileHeader from "@/components/dashboard/MobileHeader";
import ProjectCard from "@/components/dashboard/ProjectCard";
import APISettings from "@/components/settings/APISettings";
import CRMUpload from "@/components/crm/CRMUpload";
import LeadsTable from "@/components/crm/LeadsTable";
import AIChatPanel from "@/components/dashboard/AIChatPanel";
import MetricsUpload from "@/components/dashboard/MetricsUpload";
import OverviewView from "@/components/dashboard/OverviewView";
import CampaignView from "@/components/dashboard/CampaignView";
import CreativeView from "@/components/dashboard/CreativeView";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [user, setUser] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [crmRefresh, setCrmRefresh] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [selectedProject, setSelectedProject] = useState("all");
  
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
      else setUser(session.user);
    };
    checkAuth();
  }, [navigate]);

  const { 
    campaignPerformance = [], 
    kpis = { investido: 0, totalLeadsCRM: 0, totalLeadsMeta: 0, cplReal: 0, cplMeta: 0, roiReal: 0 }, 
    funnelData = [], 
    adsData = [], 
    isLoading, 
    isUsingMockData,
    refetch: loadDashboardData,
  } = useDashboardData(user?.id || "", date, toast);

  const displayedData = useMemo(() => {
    if (selectedProject === "all") return { kpis, campaignPerformance };
    const project = campaignPerformance.find((p: any) => p.name === selectedProject);
    if (!project) return { kpis, campaignPerformance };
    return {
      kpis: {
        investido: project.spent,
        totalLeadsCRM: project.leads,
        totalLeadsMeta: project.leadsMeta,
        cplReal: project.cplReal,
        cplMeta: project.cplMeta,
        roiReal: kpis.roiReal,
      },
      campaignPerformance: [project]
    };
  }, [selectedProject, kpis, campaignPerformance]);

  const handleExportPDF = async () => {
    setIsExporting(true);
    toast({ title: "Gerando PDF...", description: "Preparando relatório estratégico." });
    try {
      const reportElement = document.getElementById('pdf-page-1');
      if (!reportElement) throw new Error("Template não encontrado");
      const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, (canvas.height * 210) / canvas.width);
      pdf.save(`Relatorio_${selectedProject}_${new Date().getTime()}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  if (!user || isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0f172a]">
        <Loader2 className="h-8 w-8 animate-spin text-[#f90f54]" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f172a] text-slate-200">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Sidebar onNavigate={(page) => page === 'chat' ? setShowAIChat(true) : setCurrentPage(page)} currentPage={currentPage} />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        {isMobile ? (
          <MobileHeader date={date} setDate={setDate} isUsingMockData={isUsingMockData} />
        ) : (
          /* Desktop Header */
          <header className="h-20 flex-shrink-0 flex items-center justify-between px-8 border-b border-slate-800/50 bg-[#0f172a]/80 backdrop-blur-xl z-20">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tighter text-white">REAL <span className="text-[#f90f54]">ROI HUB</span></h1>
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-full border border-slate-700/50">
                  <span className={`w-2 h-2 rounded-full animate-pulse ${isUsingMockData ? 'bg-red-500' : 'bg-green-500'}`}></span>
                  <span className="text-[10px] uppercase font-bold text-slate-400">
                    API Status: {isUsingMockData ? 'Offline' : 'Live'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {currentPage === "dashboard" && (
                <>
                  <Button 
                    onClick={() => {
                      toast({ title: "Sincronizando dados em tempo real..." });
                      loadDashboardData();
                    }}
                    disabled={isLoading}
                    variant="outline"
                    className="border-slate-700 bg-slate-800/50 hover:bg-slate-800"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                    Sincronizar com Meta
                  </Button>
                  <DatePickerWithRange date={date} setDate={setDate} />
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger className="w-[220px] bg-[#1e293b] border-slate-700 text-white">
                      <SelectValue placeholder="Selecionar Projeto" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e293b] border-slate-700 text-white">
                      <SelectItem value="all">Todos os Projetos</SelectItem>
                      {campaignPerformance?.map((p: any) => (
                        <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleExportPDF} 
                    className="bg-gradient-to-r from-[#f90f54] to-[#8735d2] text-white font-bold px-6 shadow-lg transition-all hover:scale-105 min-h-[44px] active:scale-95"
                  >
                    <FileDown className="w-4 h-4 mr-2" /> Exportar Relatório
                  </Button>
                </>
              )}
            </div>
          </header>
        )}

        <main className={`flex-1 overflow-y-auto bg-[#0f172a] ${isMobile ? 'p-4 pb-24' : 'p-8'}`}>
          <div className="max-w-[1600px] mx-auto space-y-6 md:space-y-8">
            
            {currentPage === "dashboard" ? (
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                  <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
                  <TabsTrigger value="creatives">Criativos</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="space-y-4">
                  <OverviewView
                    kpis={displayedData.kpis}
                    campaignPerformance={displayedData.campaignPerformance}
                    funnelData={funnelData}
                    isMobile={isMobile}
                  />
                </TabsContent>
                <TabsContent value="campaigns">
                  <CampaignView
                    campaigns={displayedData.campaignPerformance || []}
                    isMobile={isMobile}
                  />
                </TabsContent>
                <TabsContent value="creatives">
                  <CreativeView creatives={adsData || []} />
                </TabsContent>
              </Tabs>
            ) : currentPage === "settings" ? (
              <APISettings userId={user.id} />
            ) : null }
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <BottomNav onNavigate={(page) => page === 'chat' ? setShowAIChat(true) : setCurrentPage(page)} currentPage={currentPage} />
      )}

      {showAIChat && (
        <AIChatPanel
          onClose={() => setShowAIChat(false)}
          user={user}
          dashboardContext={JSON.stringify({ 
            kpis: displayedData.kpis, 
            performance: displayedData.campaignPerformance, 
            funnel: funnelData 
          })}
        />
      )}

      {/* Template PDF Oculto */}
      <div id="pdf-report-root" style={{ position: 'absolute', left: '-9999px', width: '1000px', background: '#fff' }}>
        <div id="pdf-page-1" style={{ padding: '60px', minHeight: '1414px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '4px solid #f90f54', paddingBottom: '30px', marginBottom: '50px' }}>
            <h1 style={{ fontSize: '32px', color: '#0f172a', margin: 0 }}>REAL <span style={{ color: '#f90f54' }}>ROI HUB</span></h1>
            <p id="pdf-date" style={{ fontWeight: 'bold' }}></p>
          </div>
          <div id="pdf-invest"></div><div id="pdf-leads"></div><div id="pdf-cpl"></div>
          <table id="pdf-table-projects"><tbody></tbody></table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
