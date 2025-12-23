import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface TemporalChartProps {
  data: Array<{
    date: string;
    investimento: number;
    leads: number;
  }>;
  title: string;
}

const TemporalChart = ({ data, title }: TemporalChartProps) => {
  return (
    <div className="chart-container">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorInvestimento" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(174, 100%, 50%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(174, 100%, 50%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 76%, 50%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(142, 76%, 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 47%, 20%)" opacity={0.5} />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }}
              tickFormatter={(value) => `R$${value >= 1000 ? `${value / 1000}k` : value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(222, 47%, 11%)',
                border: '1px solid hsl(222, 47%, 20%)',
                borderRadius: '12px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
              }}
              labelStyle={{ color: 'hsl(210, 40%, 98%)' }}
              formatter={(value: number, name: string) => [
                name === 'investimento' ? `R$ ${value.toLocaleString('pt-BR')}` : value,
                name === 'investimento' ? 'Investimento' : 'Leads'
              ]}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => <span className="text-muted-foreground capitalize">{value === 'investimento' ? 'Investimento' : 'Leads'}</span>}
            />
            <Area
              type="monotone"
              dataKey="investimento"
              stroke="hsl(174, 100%, 50%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorInvestimento)"
            />
            <Area
              type="monotone"
              dataKey="leads"
              stroke="hsl(142, 76%, 50%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorLeads)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TemporalChart;
