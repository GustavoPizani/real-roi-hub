import { useState, useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DateRange } from "react-day-picker";
import { subDays } from "date-fns";
import { FileDown, Zap, Loader2, MessageSquare, BrainCircuit, CalendarDays } from "lucide-react";
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
import { useDashboardData } from "@/hooks/useDashboardData";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const dashboardRef = useRef<HTMLDivElement>(null);

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
    kpis = { investido: 0, resultado: 0, custoPorResultado: 0, roiReal: 0 }, 
    funnelData = [], 
    adsData = [], 
    isLoading, 
    isUsingMockData 
  } = useDashboardData(user?.id || "", date);

  const displayedData = useMemo(() => {
    if (selectedProject === "all") return { kpis, campaignPerformance };
    const project = campaignPerformance.find((p: any) => p.name === selectedProject);
    if (!project) return { kpis, campaignPerformance };
    return {
      kpis: {
        investido: project.spent,
        resultado: project.leads,
        custoPorResultado: project.cplReal,
        roiReal: kpis.roiReal
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
              <div ref={dashboardRef} className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
                
                {/* Mobile Project Filter */}
                {isMobile && (
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger className="w-full bg-[#1e293b] border-slate-700 text-white min-h-[44px]">
                      <SelectValue placeholder="Selecionar Projeto" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1e293b] border-slate-700 text-white">
                      <SelectItem value="all">Todos os Projetos</SelectItem>
                      {campaignPerformance?.map((p: any) => (
                        <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* KPI Grid - 1 col mobile, 4 cols desktop */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                  {[
                    { label: "Investimento Total", val: `R$ ${displayedData.kpis.investido.toLocaleString('pt-BR')}`, sub: "Métrica Meta Ads", color: "text-white" },
                    { label: "Leads CRM (Real)", val: displayedData.kpis.resultado, sub: "Métrica Banco de Dados", color: "text-[#f90f54]" },
                    { label: "CPL Médio Individual", val: `R$ ${displayedData.kpis.custoPorResultado.toFixed(2)}`, sub: "Investimento / Leads CRM", color: "text-[#00C49F]" },
                    { label: "ROI Real Estimado", val: `${displayedData.kpis.roiReal.toFixed(1)}x`, sub: "Baseado em Conversões CRM", color: "text-white" },
                  ].map((kpi, i) => (
                    <div key={i} className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 p-5 md:p-6 rounded-2xl md:rounded-[20px] shadow-xl">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{kpi.label}</span>
                      <p className={`text-2xl md:text-3xl font-bold mt-2 tracking-tight ${kpi.color}`}>{kpi.val}</p>
                      <p className="text-[10px] text-slate-500 mt-2 md:mt-3 font-medium uppercase opacity-60">{kpi.sub}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                  <div className="lg:col-span-2 space-y-6 md:space-y-8">
                    {/* Projetos - Cards on mobile, Table on desktop */}
                    <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 rounded-2xl md:rounded-[24px] p-5 md:p-7 shadow-2xl">
                      <h3 className="text-sm font-bold uppercase text-white mb-5 md:mb-6 tracking-widest flex items-center gap-2">
                        <Zap className="w-4 h-4 text-[#f90f54]" /> Sincronização de Projetos
                      </h3>
                      
                      {isMobile ? (
                        /* Mobile: Stacked Cards */
                        <div className="space-y-4">
                          {displayedData.campaignPerformance?.map((p: any, i: number) => (
                            <ProjectCard key={i} project={p} />
                          ))}
                        </div>
                      ) : (
                        /* Desktop: Table */
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="text-slate-500 border-b border-slate-800/50">
                                <th className="pb-4 uppercase tracking-widest">Projeto</th>
                                <th className="pb-4 uppercase tracking-widest">Investido</th>
                                <th className="pb-4 text-center uppercase tracking-widest">Leads CRM</th>
                                <th className="pb-4 text-center uppercase tracking-widest">CPL Real</th>
                                <th className="pb-4 uppercase tracking-widest">Qualidade</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/30">
                              {displayedData.campaignPerformance?.map((p: any, i: number) => (
                                <tr key={i} className="hover:bg-white/[0.02] transition-all">
                                  <td className="py-5 font-bold text-slate-200 text-sm">{p.name}</td>
                                  <td className="py-5 text-slate-400 font-mono">R$ {p.spent?.toLocaleString('pt-BR')}</td>
                                  <td className="py-5 text-center font-bold text-[#f90f54] text-sm">{p.leads}</td>
                                  <td className="py-5 text-center font-bold text-[#00C49F] text-sm">R$ {p.cplReal?.toFixed(2)}</td>
                                  <td className="py-5">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest border shadow-sm ${p.status === 'OTIMIZADO' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                                      {p.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Funil Waterfall - 100% width on mobile */}
                    <div className="bg-[#1e293b]/40 backdrop-blur-md border border-slate-700/50 rounded-2xl md:rounded-[24px] p-5 md:p-7 shadow-2xl">
                      <h3 className="text-sm font-bold mb-8 md:mb-10 uppercase text-slate-400 tracking-[0.15em]">Funil de Conversão Integrado</h3>
                      <div className="space-y-8 md:space-y-10">
                        {funnelData?.map((f: any, i: number) => (
                          <div key={i} className="group">
                            <div className="flex justify-between text-[10px] font-black mb-3 uppercase tracking-widest">
                              <span className={i === 0 ? "text-slate-300" : i === 1 ? "text-[#0088FE]" : "text-[#00C49F]"}>{f.name}</span>
                              <span className="text-white bg-slate-800/50 px-2 py-0.5 rounded transition-all group-hover:bg-[#f90f54]/20">{f.value} ({f.percentage?.toFixed(1)}%)</span>
                            </div>
                            <div className="w-full bg-slate-800/50 h-6 md:h-7 rounded-lg overflow-hidden border border-slate-700/30">
                              <div className={`${f.color} h-full transition-all duration-1000 shadow-lg`} style={{ width: `${f.percentage}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 md:space-y-8">
                    {/* CIA Insights */}
                    <div className="bg-[#1e293b]/40 backdrop-blur-md border-t-[3px] border-t-[#f90f54] border-x border-slate-700/50 border-b border-slate-700/50 p-5 md:p-7 rounded-2xl md:rounded-[24px] shadow-2xl">
                      <div className="flex items-center gap-3 mb-5 md:mb-6 text-[#f90f54]">
                        <Zap className="w-5 h-5 fill-current" />
                        <h3 className="font-black text-xs uppercase tracking-[0.2em]">CIA Strategic Insights</h3>
                      </div>
                      <div className="space-y-4 md:space-y-5 text-sm leading-relaxed text-slate-400 font-medium">
                        <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/30">
                          🚀 <strong className="text-slate-200">Sugestão:</strong> {displayedData.campaignPerformance.some((p:any) => p.status === 'OTIMIZADO') 
                            ? 'Projetos de alta performance detectados. Realoque verba para maximizar ROI.' 
                            : 'Otimize os criativos das campanhas em REVISAR para baixar o CPL.'}
                        </div>
                        <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/30">
                          ⚠️ <strong className="text-slate-200">Gargalo:</strong> {funnelData?.[1]?.percentage < 15 
                            ? 'Baixa conversão de Visitas. Verifique o atendimento comercial.' 
                            : 'Fluxo de visitas saudável. Foque no fechamento.'}
                        </div>
                      </div>
                    </div>

                    {/* IA Advisor Card */}
                    <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-[#f90f54]/30 p-5 md:p-7 rounded-2xl md:rounded-[24px] shadow-2xl">
                       <div className="flex items-center gap-3 mb-4 text-white">
                        <BrainCircuit className="w-6 h-6 text-[#f90f54]" />
                        <h3 className="font-bold text-sm uppercase tracking-wider">IA ADVISOR</h3>
                      </div>
                      <p className="text-xs text-slate-400 mb-5 md:mb-6 leading-relaxed">
                        Dúvidas sobre os dados? Peça uma análise profunda do ROI real do seu CRM.
                      </p>
                      <Button 
                        onClick={() => setShowAIChat(true)}
                        className="w-full bg-[#f90f54]/10 hover:bg-[#f90f54]/20 text-[#f90f54] border border-[#f90f54]/30 font-black py-5 md:py-6 rounded-xl transition-all min-h-[44px] active:scale-95"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" /> CONSULTAR IA
                      </Button>
                    </div>

                    {/* Mobile Export Button */}
                    {isMobile && (
                      <Button 
                        onClick={handleExportPDF} 
                        className="w-full bg-gradient-to-r from-[#f90f54] to-[#8735d2] text-white font-bold shadow-lg transition-all min-h-[48px] active:scale-95"
                      >
                        <FileDown className="w-4 h-4 mr-2" /> Exportar Relatório
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : currentPage === "settings" ? (
              <APISettings userId={user.id} />
            ) : (
              <div className="space-y-6 md:space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                <CRMUpload userId={user.id} onUploadComplete={() => setCrmRefresh(p => p + 1)} campaigns={campaignPerformance} />
                <LeadsTable userId={user.id} refreshTrigger={crmRefresh} campaigns={campaignPerformance} />
              </div>
            )}
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
