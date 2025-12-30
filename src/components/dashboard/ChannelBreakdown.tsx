import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface ChannelDataPoint {
  name: string;
  value: number;
}

interface ChannelBreakdownProps {
  data: ChannelDataPoint[];
  title: string;
}

// Cores específicas para cada plataforma para melhor identificação
const PLATFORM_COLORS = {
  facebook: '#0088FE', // Azul
  instagram: '#AF19FF', // Roxo
  messenger: '#00C49F', // Verde
  audience_network: '#FFBB28', // Laranja
  default: '#FF8042', // Fallback
};

// Função para atribuir cor baseada no nome da plataforma
const getColor = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('facebook')) return PLATFORM_COLORS.facebook;
  if (lowerName.includes('instagram')) return PLATFORM_COLORS.instagram;
  if (lowerName.includes('messenger')) return PLATFORM_COLORS.messenger;
  if (lowerName.includes('audience')) return PLATFORM_COLORS.audience_network;
  return PLATFORM_COLORS.default;
};

const formatName = (name: string) => 
  name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace('Facebook', 'FB')
    .replace('Instagram', 'IG');

const ChannelBreakdown = ({ data, title }: ChannelBreakdownProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="glass-card p-6 flex flex-col h-full">
        <h3 className="font-semibold mb-4">{title}</h3>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Sem dados de canais</p>
        </div>
      </div>
    );
  }

  const processedData = data.map(item => ({
    ...item,
    name: formatName(item.name),
  }));

  return (
    <div className="glass-card p-6 flex flex-col h-full">
      <h3 className="font-semibold mb-4">{title}</h3>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <Pie
              data={processedData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius="80%"
              fill="#8884d8"
              dataKey="value"
              nameKey="name"
            >
              {processedData.map((entry) => (
                <Cell key={`cell-${entry.name}`} fill={getColor(entry.name)} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => value.toLocaleString('pt-BR')}
              contentStyle={{
                backgroundColor: '#1a1f2c',
                borderColor: 'hsl(var(--border))',
                borderRadius: 'var(--radius)',
                backdropFilter: 'blur(4px)',
              }}
              itemStyle={{ color: '#ffffff' }}
            />
            <Legend 
              layout="vertical" 
              verticalAlign="middle" 
              align="right"
              iconSize={10}
              wrapperStyle={{ paddingLeft: '20px', maxHeight: '200px', overflowY: 'auto' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChannelBreakdown;
