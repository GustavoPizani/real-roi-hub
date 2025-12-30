import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DateRange } from "react-day-picker";
import { subDays, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, FileText, TrendingUp, Percent, AlertCircle, FileDown } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import Sidebar from "@/components/dashboard/Sidebar";
import KPICard from "@/components/dashboard/KPICard";
import TemporalChart from "@/components/dashboard/TemporalChart";
import ChannelBreakdown from "@/components/dashboard/ChannelBreakdown";
import LeadCostInsights from "@/components/dashboard/LeadCostInsights";
import CampaignRanking from "@/components/dashboard/CampaignRanking";
import AIChatPanel from "@/components/dashboard/AIChatPanel";
import APISettings from "@/components/settings/APISettings";
import CRMUpload from "@/components/crm/CRMUpload";
import LeadsTable from "@/components/crm/LeadsTable";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [showChat, setShowChat] = useState(false);
  const [crmRefresh, setCrmRefresh] = useState(0);
  const [selectedAdId, setSelectedAdId] = useState("all");
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const { temporalData, channelsData, campaignData, adsData, kpis, leadCostInsights, isUsingMockData, isLoading, error } = useDashboardData(
    user?.id || "",
    date
  );

  const displayedKpis = useMemo(() => {
    if (selectedAdId === "all" || !adsData.length) {
      return kpis;
    }
    const selectedAd = adsData.find((ad) => ad.id === selectedAdId);
    if (!selectedAd) return kpis;

    const adLeads = selectedAd.realLeads || 0;

    return {
      investido: selectedAd.spend,
      resultado: adLeads,
      custoPorResultado: adLeads > 0 ? selectedAd.spend / adLeads : 0,
      roiReal: kpis.roiReal,
    };
  }, [selectedAdId, kpis, adsData]);

  const handleExportPDF = useCallback(async () => {
    if (!dashboardRef.current) return;

    toast({
      title: "Gerando PDF...",
      description: "Aguarde enquanto preparamos seu relatório.",
    });

    try {
      // Add light theme temporarily for PDF
      const originalBg = dashboardRef.current.style.backgroundColor;
      dashboardRef.current.style.backgroundColor = "#ffffff";
      dashboardRef.current.classList.add("pdf-export-mode");

      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      // Restore original styles
      dashboardRef.current.style.backgroundColor = originalBg;
      dashboardRef.current.classList.remove("pdf-export-mode");

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(imgData, "PNG", imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      const dateStr = format(new Date(), "yyyy-MM-dd");
      pdf.save(`dashboard-report-${dateStr}.pdf`);

      toast({
        title: "PDF exportado!",
        description: "O relatório foi salvo com sucesso.",
      });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível gerar o PDF.",
        variant: "destructive",
      });
    }
  }, [toast]);


  const handleNavigate = (page: string) => {
    if (page === "chat") {
      setShowChat(!showChat);
    } else {
      setCurrentPage(page);
      setShowChat(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar onNavigate={handleNavigate} currentPage={currentPage} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header Fixo */}
        <header className="h-16 flex-shrink-0 border-b border-border flex items-center justify-between px-6">
          <div>
            <h1 className="text-xl font-semibold capitalize">
              {currentPage === "dashboard" ? "Dashboard" : currentPage === "crm" ? "CRM" : "Configurações"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isUsingMockData && currentPage === "dashboard"
                ? "Exibindo dados de demonstração"
                : "Dados atualizados em tempo real"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {currentPage === "dashboard" && !isLoading && (
              <div className="w-[280px]">
                <DatePickerWithRange date={date} setDate={setDate} />
              </div>
            )}
            {currentPage === "dashboard" && !isLoading && adsData.length > 0 && (
              <Select value={selectedAdId} onValueChange={setSelectedAdId}>
                <SelectTrigger className="w-[280px] bg-surface-2 border-border hover:border-muted-foreground transition-colors">
                  <SelectValue placeholder="Filtrar por anúncio..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os anúncios</SelectItem>
                  {adsData.map((ad) => (
                    <SelectItem key={ad.id} value={ad.id}>
                      {ad.name.length > 40 ? `${ad.name.substring(0, 40)}...` : ad.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {currentPage === "dashboard" && !isLoading && !isUsingMockData && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportPDF}
                className="gap-2"
              >
                <FileDown className="w-4 h-4 mr-2" />
                Exportar PDF
              </Button>
            )}
          </div>
        </header>

        {/* Área de Conteúdo com Scroll */}
        <main className="flex-1 overflow-y-auto p-6">
          {currentPage === "dashboard" && (
            <>
              {/* Empty State or Mock Data Warning */}
              {isUsingMockData && (
                <div className="glass-card p-6 mb-6 border-neon-orange/30 animate-fade-in">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-neon-orange/10 flex items-center justify-center">
                      <AlertCircle className="w-6 h-6 text-neon-orange" />
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-semibold text-neon-orange">APIs não configuradas</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {error || "Configure suas APIs Meta nas configurações para ver dados reais de suas campanhas."}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => setCurrentPage("settings")}
                      className="bg-neon-orange/10 hover:bg-neon-orange/20 text-neon-orange"
                    >
                      Configurar APIs
                    </Button>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">Carregando dados...</p>
                  </div>
                </div>
              )}

              {/* Dashboard Content */}
              {!isLoading && !isUsingMockData && (
                <div ref={dashboardRef}>
                  <LeadCostInsights 
                    cheapest={leadCostInsights?.cheapest} 
                    mostExpensive={leadCostInsights?.mostExpensive} 
                  />

                  {/* KPIs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <KPICard
                      title="Investido"
                      value={`R$ ${displayedKpis.investido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                      subtitle="Últimos 30 dias"
                      icon={DollarSign}
                      variant="primary"
                      delay={0}
                    />
                    <KPICard
                      title="Resultado"
                      value={displayedKpis.resultado.toString()}
                      subtitle="Leads gerados"
                      icon={FileText}
                      variant="success"
                      delay={100}
                    />
                    <KPICard
                      title="Custo por Resultado"
                      value={`R$ ${displayedKpis.custoPorResultado.toFixed(2)}`}
                      subtitle="CPR médio"
                      icon={TrendingUp}
                      variant="warning"
                      delay={200}
                    />
                    <KPICard
                      title="ROI Real"
                      value={`${displayedKpis.roiReal.toFixed(1)}%`}
                      subtitle="Retorno sobre investimento"
                      icon={Percent}
                      variant="default"
                      delay={300}
                    />
                  </div>

                  {/* Charts Row 1 */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                    <div className="lg:col-span-2">
                      <TemporalChart data={temporalData} title="Visão Temporal" />
                    </div>
                    <ChannelBreakdown data={channelsData} title="Canais de Entrada" />
                  </div>

                  {/* Charts Row 2 -> now just CampaignRanking */}
                  <div className="mb-6">
                    <CampaignRanking campaigns={campaignData} title="Ranking de Campanhas" />
                  </div>
                </div>
              )}
            </>
          )}

          {currentPage === "settings" && <APISettings userId={user.id} />}

          {currentPage === "crm" && (
            <div className="space-y-6">
              <CRMUpload 
                userId={user.id} 
                onUploadComplete={() => setCrmRefresh((prev) => prev + 1)} 
                campaigns={campaignData}
              />
              <LeadsTable userId={user.id} refreshTrigger={crmRefresh} campaigns={campaignData} />
            </div>
          )}
        </main>
      </div>

      {/* AI Chat Panel */}
      {showChat && (
        <AIChatPanel
          onClose={() => setShowChat(false)}
          dashboardContext={JSON.stringify({ kpis, isUsingMockData })}
        />
      )}
    </div>
  );
};

export default Dashboard;
