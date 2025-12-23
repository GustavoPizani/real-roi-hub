import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface DevicesChartProps {
  data: Array<{
    name: string;
    value: number;
  }>;
  title: string;
}

const COLORS = [
  "hsl(174, 100%, 50%)",
  "hsl(142, 76%, 50%)",
  "hsl(280, 100%, 65%)",
  "hsl(25, 100%, 55%)",
];

const DevicesChart = ({ data, title }: DevicesChartProps) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="chart-container">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(222, 47%, 11%)',
                border: '1px solid hsl(222, 47%, 20%)',
                borderRadius: '12px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
              }}
              formatter={(value: number) => [`${((value / total) * 100).toFixed(1)}%`, 'Participação']}
            />
            <Legend 
              layout="vertical"
              align="right"
              verticalAlign="middle"
              formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DevicesChart;
