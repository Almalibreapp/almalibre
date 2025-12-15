import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Venta } from '@/types';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface SalesChartProps {
  ventas: Venta[];
}

export const SalesChart = ({ ventas }: SalesChartProps) => {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    
    const dayVentas = ventas.filter((v) => {
      const ventaDate = new Date(v.fecha);
      return ventaDate >= dayStart && ventaDate <= dayEnd;
    });

    const total = dayVentas.reduce((sum, v) => sum + v.producto_monto, 0);

    return {
      dia: format(date, 'EEE', { locale: es }),
      ventas: dayVentas.length,
      ingresos: total,
    };
  });

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={last7Days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis 
            dataKey="dia" 
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, 'Ingresos']}
          />
          <Bar 
            dataKey="ingresos" 
            fill="hsl(var(--primary))" 
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
