import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, MessageCircle, TrendingUp, Percent, AlertCircle, FileDown } from "lucide-react";
import Sidebar from "@/components/dashboard/Sidebar";
import KPICard from "@/components/dashboard/KPICard";
import TemporalChart from "@/components/dashboard/TemporalChart";
import DevicesChart from "@/components/dashboard/DevicesChart";
import PeriodChart from "@/components/dashboard/PeriodChart";
import AdsTable from "@/components/dashboard/AdsTable";
import AIChatPanel from "@/components/dashboard/AIChatPanel";
import APISettings from "@/components/settings/APISettings";
import CRMUpload from "@/components/crm/CRMUpload";
import LeadsTable from "@/components/crm/LeadsTable";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [showChat, setShowChat] = useState(false);
  const [crmRefresh, setCrmRefresh] = useState(0);

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

  const { temporalData, devicesData, periodData, adsData, kpis, isUsingMockData, isLoading, error } = useDashboardData(
    user?.id || ""
  );

  const handleNavigate = (page: string) => {
    if (page === "chat") {
      setShowChat(!showChat);
    } else {
      setCurrentPage(page);
      setShowChat(false);
    }
  };

  const handleExportPDF = () => {
    toast({
      title: "Exportação iniciada",
      description: "O relatório PDF será gerado em breve.",
    });
    // Would implement PDF generation here
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar onNavigate={handleNavigate} currentPage={currentPage} />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6">
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
          <div className="flex items-center gap-3">
            {currentPage === "dashboard" && (
              <Button
                variant="secondary"
                onClick={handleExportPDF}
                className="bg-primary/10 hover:bg-primary/20 text-primary"
              >
                <FileDown className="w-4 h-4 mr-2" />
                Exportar PDF
              </Button>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="p-6">
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
                <>
                  {/* KPIs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <KPICard
                      title="Investido"
                      value={`R$ ${kpis.investido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                      subtitle="Últimos 30 dias"
                      icon={DollarSign}
                      variant="primary"
                      delay={0}
                    />
                    <KPICard
                      title="Resultado"
                      value={kpis.resultado.toString()}
                      subtitle="Mensagens recebidas"
                      icon={MessageCircle}
                      variant="success"
                      delay={100}
                    />
                    <KPICard
                      title="Custo por Resultado"
                      value={`R$ ${kpis.custoPorResultado.toFixed(2)}`}
                      subtitle="CPR médio"
                      icon={TrendingUp}
                      variant="warning"
                      delay={200}
                    />
                    <KPICard
                      title="ROI Real"
                      value={`${kpis.roiReal.toFixed(1)}%`}
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
                    <DevicesChart data={devicesData} title="Devices" />
                  </div>

                  {/* Charts Row 2 */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                    <PeriodChart data={periodData} title="Período do Dia" />
                    <div className="lg:col-span-2">
                      <AdsTable ads={adsData} title="Ranking de Anúncios" />
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {currentPage === "settings" && <APISettings userId={user.id} />}

          {currentPage === "crm" && (
            <div className="space-y-6">
              <CRMUpload userId={user.id} onUploadComplete={() => setCrmRefresh((prev) => prev + 1)} />
              <LeadsTable userId={user.id} refreshTrigger={crmRefresh} />
            </div>
          )}
        </div>
      </main>

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
