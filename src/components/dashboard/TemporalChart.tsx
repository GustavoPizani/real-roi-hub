import { 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TemporalChartProps {
  data: any[];
  isLoading: boolean;
}

// --- TOOLTIP PERSONALIZADO (Correção de Cores e Nomes) ---
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0f172a] border border-slate-700/50 p-3 rounded-xl shadow-xl backdrop-blur-md">
        {/* Data no topo */}
        <p className="text-slate-400 text-xs mb-2 font-medium border-b border-slate-800 pb-1">
          {label ? format(new Date(label), "dd 'de' MMMM", { locale: ptBR }) : ""}
        </p>
        
        {/* Itens do Gráfico */}
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 mb-1">
            <div className="flex items-center gap-2">
              {/* Bolinha com a cor da série */}
              <div 
                className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" 
                style={{ backgroundColor: entry.color }} 
              />
              {/* Nome com a cor da série (Pedido atendido) */}
              <span className="text-xs font-bold" style={{ color: entry.color }}>
                {entry.name}:
              </span>
            </div>
            {/* Valor em Branco */}
            <span className="text-xs text-white font-mono">
              {new Intl.NumberFormat("pt-BR", { 
                style: "currency", 
                currency: "BRL" 
              }).format(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const TemporalChart = ({ data, isLoading }: TemporalChartProps) => {
  if (isLoading) {
    return (
      <Card className="bg-[#1e293b]/40 border border-slate-700/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white">Evolução: Investimento x CPL</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full bg-slate-700" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#1e293b]/40 border border-slate-700/50 backdrop-blur-md shadow-xl">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          Evolução Diária
          <span className="text-xs font-normal text-slate-400">(Barras: Investimento | Linha: CPL)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f90f54" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f90f54" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              
              <XAxis 
                dataKey="date" 
                stroke="#94a3b8" 
                fontSize={12}
                tickFormatter={(val) => {
                  try {
                    return format(new Date(val), 'dd/MM', { locale: ptBR });
                  } catch { return val; }
                }}
              />
              
              {/* Eixo Esquerdo (Investimento - Rosa) */}
              <YAxis 
                yAxisId="left"
                stroke="#f90f54" 
                fontSize={12}
                tickFormatter={(val) => `R$${val}`}
              />
              
              {/* Eixo Direito (CPL - Verde) */}
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="#22c55e" 
                fontSize={12}
                tickFormatter={(val) => `R$${val}`}
              />
              
              {/* Tooltip Customizado aplicado aqui */}
              <Tooltip content={<CustomTooltip />} />
              
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              
              <Bar 
                yAxisId="left"
                dataKey="spend" 
                name="Investimento" // Esse nome vai para o Tooltip e Legenda
                fill="url(#colorSpend)" 
                stroke="#f90f54" // Define a cor para o Tooltip pegar (entry.color)
                barSize={20}
                radius={[4, 4, 0, 0]}
              />
              
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="cpl" 
                name="CPL" // Esse nome vai para o Tooltip e Legenda
                stroke="#22c55e" // Define a cor para o Tooltip pegar (entry.color)
                strokeWidth={3}
                dot={{ r: 4, fill: "#22c55e" }}
                activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};