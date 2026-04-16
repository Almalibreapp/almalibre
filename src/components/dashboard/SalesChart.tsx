import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Venta } from '@/types';
import { convertirHoraSegunMaquina } from '@/lib/timezone-utils';

interface SalesChartProps {
  ventas: Venta[];
  fecha?: string;
  imei?: string;
}

export const SalesChart = ({ ventas, fecha, imei = '' }: SalesChartProps) => {
  // Group sales by hour using fecha_hora_china → convertirHoraSegunMaquina
  const ventasPorHora = ventas.reduce((acc, venta) => {
    const hora = (venta as any)._spainHora
      || ((venta as any).fecha_hora_china ? convertirHoraSegunMaquina((venta as any).fecha_hora_china, imei) : venta.hora)
      || '00:00';
    const horaKey = hora.split(':')[0] + ':00';
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

  const totalVentas = data.reduce((s, d) => s + d.ventas, 0);
  const totalIngresos = data.reduce((s, d) => s + d.ingresos, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 bg-muted/50 rounded-lg">
          <p className="text-lg font-bold text-primary">{totalVentas}</p>
          <p className="text-[10px] text-muted-foreground">Ventas</p>
        </div>
        <div className="p-2 bg-muted/50 rounded-lg">
          <p className="text-lg font-bold text-primary">{totalIngresos.toFixed(2)}€</p>
          <p className="text-[10px] text-muted-foreground">Ingresos</p>
        </div>
        <div className="p-2 bg-muted/50 rounded-lg">
          <p className="text-lg font-bold text-primary">
            {totalVentas > 0 ? (totalIngresos / totalVentas).toFixed(2) : '0.00'}€
          </p>
          <p className="text-[10px] text-muted-foreground">Ticket medio</p>
        </div>
      </div>

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
              labelFormatter={(label) => `${label} (hora española)`}
            />
            <Bar 
              dataKey="ingresos" 
              fill="hsl(var(--primary))" 
              radius={[4, 4, 0, 0]}
              name="ingresos"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {data.map((d) => (
          <div key={d.hora} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-md bg-muted/30">
            <span className="font-medium text-muted-foreground">{d.hora}h</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{d.ventas} venta{d.ventas !== 1 ? 's' : ''}</span>
              <span className="font-semibold text-primary">{d.ingresos.toFixed(2)}€</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
