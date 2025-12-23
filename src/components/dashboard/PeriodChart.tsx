import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface PeriodChartProps {
  data: Array<{
    period: string;
    value: number;
  }>;
  title: string;
}

const PeriodChart = ({ data, title }: PeriodChartProps) => {
  return (
    <div className="chart-container">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={data} 
            layout="vertical"
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 47%, 20%)" opacity={0.5} horizontal={false} />
            <XAxis 
              type="number"
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }}
            />
            <YAxis 
              type="category"
              dataKey="period"
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }}
              width={80}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(222, 47%, 11%)',
                border: '1px solid hsl(222, 47%, 20%)',
                borderRadius: '12px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
              }}
              formatter={(value: number) => [`${value} leads`, 'Total']}
              cursor={{ fill: 'hsl(222, 47%, 15%)', opacity: 0.5 }}
            />
            <Bar 
              dataKey="value" 
              fill="hsl(174, 100%, 50%)" 
              radius={[0, 4, 4, 0]}
              barSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PeriodChart;
