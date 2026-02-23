import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTemperatureLog, useLogTemperature } from '@/hooks/useTemperatureLog';
import { TemperaturaResponse } from '@/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine, Area, CartesianGrid,
} from 'recharts';
import {
  Thermometer, Download, Loader2, TrendingDown, TrendingUp, Activity,
} from 'lucide-react';

interface TemperatureTraceabilityProps {
  maquinaId: string | undefined;
  temperatura: TemperaturaResponse | undefined;
  imei?: string;
}

const TIME_FILTERS = [
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
] as const;

const THRESHOLD = 11;

export const TemperatureTraceability = ({ maquinaId, temperatura, imei }: TemperatureTraceabilityProps) => {
  const [selectedHours, setSelectedHours] = useState(24);
  const { data: readings, isLoading } = useTemperatureLog(maquinaId, selectedHours, imei);
  const logTemperature = useLogTemperature();
  const lastLoggedRef = useRef<string | null>(null);

  // Auto-log each new API reading to the database
  useEffect(() => {
    if (!maquinaId || !temperatura || temperatura.temperatura === undefined) return;

    const key = `${temperatura.temperatura}-${temperatura.timestamp}`;
    if (lastLoggedRef.current === key) return;
    lastLoggedRef.current = key;

    const estado = temperatura.temperatura >= THRESHOLD ? 'critico' : 'normal';
    logTemperature.mutate({
      maquinaId,
      temperatura: temperatura.temperatura,
      unidad: temperatura.unidad || 'C',
      estado,
    });
  }, [maquinaId, temperatura?.temperatura, temperatura?.timestamp]);

  const chartData = useMemo(() => {
    if (!readings?.length) return [];
    return readings.map((r) => ({
      time: format(new Date(r.created_at), 'HH:mm', { locale: es }),
      fullTime: format(new Date(r.created_at), "dd/MM HH:mm:ss", { locale: es }),
      temperatura: Number(r.temperatura),
      critical: Number(r.temperatura) >= THRESHOLD,
    }));
  }, [readings]);

  const stats = useMemo(() => {
    if (!readings?.length) return null;
    const temps = readings.map((r) => Number(r.temperatura));
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const avg = temps.reduce((a, b) => a + b, 0) / temps.length;
    const criticalCount = temps.filter((t) => t >= THRESHOLD).length;
    const criticalPct = ((criticalCount / temps.length) * 100).toFixed(1);
    return { min, max, avg, totalReadings: temps.length, criticalCount, criticalPct };
  }, [readings]);

  const handleDownloadCSV = () => {
    if (!readings?.length) return;

    const headers = ['Fecha/Hora', 'Temperatura (°C)', 'Estado'];
    const rows = readings.map((r) => [
      format(new Date(r.created_at), 'dd/MM/yyyy HH:mm:ss'),
      r.temperatura.toString(),
      Number(r.temperatura) >= THRESHOLD ? 'CRÍTICO' : 'Normal',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(';')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `temperatura_${maquinaId}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Trazabilidad de Temperatura
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-md p-0.5">
              {TIME_FILTERS.map((f) => (
                <Button
                  key={f.hours}
                  variant={selectedHours === f.hours ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setSelectedHours(f.hours)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleDownloadCSV}
              disabled={!readings?.length}
            >
              <Download className="h-3 w-3 mr-1" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current temperature + stats */}
        {temperatura?.temperatura !== undefined && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <Thermometer className="h-4 w-4 mx-auto mb-1 text-primary" />
              <p className={cn(
                'text-2xl font-bold',
                temperatura.temperatura >= THRESHOLD ? 'text-destructive' : 'text-primary'
              )}>
                {temperatura.temperatura}°C
              </p>
              <p className="text-[10px] text-muted-foreground">Actual</p>
            </div>
            {stats && (
              <>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <TrendingDown className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
                  <p className="text-2xl font-bold">{stats.min.toFixed(1)}°</p>
                  <p className="text-[10px] text-muted-foreground">Mínima</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <TrendingUp className="h-4 w-4 mx-auto mb-1 text-orange-500" />
                  <p className="text-2xl font-bold">{stats.max.toFixed(1)}°</p>
                  <p className="text-[10px] text-muted-foreground">Máxima</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <Activity className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-2xl font-bold">{stats.avg.toFixed(1)}°</p>
                  <p className="text-[10px] text-muted-foreground">Media ({stats.totalReadings} lecturas)</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Chart */}
        {isLoading ? (
          <div className="h-56 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-muted-foreground">
            <Thermometer className="h-8 w-8 mb-2" />
            <p className="text-sm">Sin lecturas en las últimas {selectedHours}h</p>
            <p className="text-xs">Las lecturas se registran automáticamente cada 30s</p>
          </div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="time"
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
                  tickFormatter={(v) => `${v}°`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullTime || ''}
                  formatter={(value: number) => [
                    `${value.toFixed(1)}°C`,
                    value >= THRESHOLD ? '⚠️ CRÍTICO' : '✅ Normal',
                  ]}
                />
                <ReferenceLine
                  y={THRESHOLD}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{
                    value: `Límite ${THRESHOLD}°C`,
                    position: 'insideTopRight',
                    fill: 'hsl(var(--destructive))',
                    fontSize: 10,
                  }}
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
        )}

        {/* Critical alerts summary */}
        {stats && stats.criticalCount > 0 && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <Badge variant="destructive" className="text-xs">
              ⚠️ {stats.criticalCount} alertas
            </Badge>
            <p className="text-xs text-muted-foreground">
              {stats.criticalPct}% de las lecturas superaron los {THRESHOLD}°C en las últimas {selectedHours}h
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
