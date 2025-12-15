import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Temperatura } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TemperatureChartProps {
  historial: Temperatura[];
}

export const TemperatureChart = ({ historial }: TemperatureChartProps) => {
  const data = historial
    .slice(0, 24)
    .reverse()
    .map((item) => ({
      hora: format(new Date(item.fecha), 'HH:mm', { locale: es }),
      temperatura: item.temperatura,
    }));

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis 
            dataKey="hora" 
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis 
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            domain={['dataMin - 2', 'dataMax + 2']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number) => [`${value.toFixed(1)}°C`, 'Temperatura']}
          />
          <Line
            type="monotone"
            dataKey="temperatura"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
