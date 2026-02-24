import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Venta } from '@/types';
import { convertChinaToSpain } from '@/lib/timezone';

interface SalesChartProps {
  ventas: Venta[];
  fecha?: string; // fecha del día de las ventas (formato YYYY-MM-DD)
}

export const SalesChart = ({ ventas, fecha }: SalesChartProps) => {
  // La API devuelve ventas del día actual con hora, no historial de 7 días
  // Agrupamos por hora para mostrar actividad del día
  const ventasPorHora = ventas.reduce((acc, venta) => {
    const horaSpain = (venta as any)._spainHora || convertChinaToSpain(venta.hora, fecha);
    const horaKey = horaSpain.split(':')[0] + ':00';
    if (!acc[horaKey]) {
      acc[horaKey] = { cantidad: 0, ingresos: 0 };
    }
    acc[horaKey].cantidad += 1;
    acc[horaKey].ingresos += venta.precio;
    return acc;
  }, {} as Record<string, { cantidad: number; ingresos: number }>);

  const data = Object.entries(ventasPorHora)
    .map(([hora, datos]) => ({
      hora,
      ventas: datos.cantidad,
      ingresos: datos.ingresos,
    }))
    .sort((a, b) => a.hora.localeCompare(b.hora));

  if (data.length === 0) {
    return (
      <div className="h-48 w-full flex items-center justify-center text-muted-foreground">
        Sin ventas registradas hoy
      </div>
    );
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis 
            dataKey="hora" 
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
            formatter={(value: number, name: string) => [
              name === 'ingresos' ? `${value.toFixed(2)}€` : value,
              name === 'ingresos' ? 'Ingresos' : 'Ventas'
            ]}
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
