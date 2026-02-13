import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/layout/BottomNav';
import { useNetworkSales, useNetworkDetail, useNetworkTemperatures } from '@/hooks/useNetworkData';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Euro,
  TrendingUp,
  Clock,
  Flame,
  Thermometer,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';

type ViewPeriod = 'hoy' | 'ayer' | 'mes';

export const NetworkDashboard = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<ViewPeriod>('hoy');
  
  // Calculate date for detail queries
  const getDateForPeriod = () => {
    if (period === 'ayer') {
      const ayer = new Date();
      ayer.setDate(ayer.getDate() - 1);
      return ayer.toISOString().split('T')[0];
    }
    return undefined; // today = no date param
  };

  const { data: salesData, isLoading: loadingSales, refetch: refetchSales } = useNetworkSales();
  const { data: detailData, isLoading: loadingDetail } = useNetworkDetail(getDateForPeriod());
  const { data: tempData, isLoading: loadingTemp } = useNetworkTemperatures();

  const isLoading = loadingSales || loadingDetail;

  // Get totals for current period
  const getTotals = () => {
    if (!salesData) return { cantidad: 0, total_euros: 0 };
    switch (period) {
      case 'hoy': return salesData.totales.hoy;
      case 'ayer': return salesData.totales.ayer;
      case 'mes': return salesData.totales.mes;
    }
  };

  const totals = getTotals();

  // Build chart data: sales per hour
  const buildHourlyChart = () => {
    if (!detailData?.todasLasVentas) return [];
    const porHora: Record<string, { ventas: number; ingresos: number }> = {};
    detailData.todasLasVentas.forEach(v => {
      const hora = v.hora.split(':')[0] + ':00';
      if (!porHora[hora]) porHora[hora] = { ventas: 0, ingresos: 0 };
      porHora[hora].ventas += 1;
      porHora[hora].ingresos += v.precio;
    });
    return Object.entries(porHora)
      .map(([hora, d]) => ({ hora, ventas: d.ventas, ingresos: d.ingresos }))
      .sort((a, b) => a.hora.localeCompare(b.hora));
  };

  // Build per-machine chart
  const buildMachineChart = () => {
    if (!salesData?.resumenPorMaquina) return [];
    return salesData.resumenPorMaquina
      .filter(r => r.resumen)
      .map(r => {
        const ventas = period === 'hoy' ? r.resumen!.ventas_hoy 
          : period === 'ayer' ? r.resumen!.ventas_ayer 
          : r.resumen!.ventas_mes;
        return {
          nombre: r.nombre.length > 12 ? r.nombre.substring(0, 12) + '...' : r.nombre,
          ventas: ventas?.cantidad ?? 0,
          ingresos: ventas?.total_euros ?? 0,
        };
      });
  };

  const hourlyData = buildHourlyChart();
  const machineData = buildMachineChart();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="mr-3">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold">Dashboard de Red</h1>
              <p className="text-xs text-muted-foreground">Todas las máquinas</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetchSales()} disabled={isLoading}>
            <RefreshCw className={cn("h-5 w-5", isLoading && "animate-spin")} />
          </Button>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        {/* Period selector */}
        <div className="flex items-center justify-center gap-2">
          {(['hoy', 'ayer', 'mes'] as ViewPeriod[]).map(p => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p)}
              className="capitalize"
            >
              {p === 'hoy' ? 'Hoy' : p === 'ayer' ? 'Ayer' : 'Este Mes'}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Euro className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-2xl font-bold text-primary">{totals.total_euros.toFixed(2)}€</p>
                  <p className="text-xs text-muted-foreground">Ingresos totales</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-2xl font-bold">{totals.cantidad}</p>
                  <p className="text-xs text-muted-foreground">Ventas totales</p>
                </CardContent>
              </Card>
            </div>

            {/* Peak hour */}
            {period !== 'mes' && detailData?.horaCaliente && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Flame className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Hora Caliente</p>
                    <p className="text-2xl font-bold text-primary">{detailData.horaCaliente.hora}h</p>
                    <p className="text-xs text-muted-foreground">
                      {detailData.horaCaliente.ventas} ventas · {detailData.horaCaliente.ingresos.toFixed(2)}€
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Hourly chart */}
            {period !== 'mes' && hourlyData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Ventas por Hora (Red)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="hora" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                          formatter={(value: number, name: string) => [
                            name === 'ingresos' ? `${value.toFixed(2)}€` : value,
                            name === 'ingresos' ? 'Ingresos' : 'Ventas'
                          ]}
                        />
                        <Bar dataKey="ingresos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                          {hourlyData.map((entry, index) => (
                            <Cell
                              key={index}
                              fill={entry.hora === detailData?.horaCaliente?.hora ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.5)'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Per-machine chart */}
            {machineData.length > 1 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Ingresos por Máquina
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={machineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="nombre" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                          formatter={(value: number) => [`${value.toFixed(2)}€`, 'Ingresos']}
                        />
                        <Bar dataKey="ingresos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Temperature overview */}
            {tempData && tempData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-primary" />
                    Temperaturas de la Red
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {tempData.map(t => (
                      <div key={t.maquinaId} className="flex items-center justify-between py-2 border-b last:border-0">
                        <span className="font-medium text-sm">{t.nombre}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-bold text-lg",
                            !t.temperatura ? 'text-muted-foreground' :
                            t.temperatura.temperatura >= 10 ? 'text-critical' :
                            t.temperatura.temperatura >= 5 ? 'text-warning' : 'text-success'
                          )}>
                            {t.temperatura ? `${t.temperatura.temperatura}°${t.temperatura.unidad || 'C'}` : '--°C'}
                          </span>
                          {t.temperatura && (
                            <Badge variant="outline" className={cn(
                              "text-xs",
                              t.temperatura.estado === 'normal' && "border-success/30 text-success",
                              t.temperatura.estado === 'alerta' && "border-warning/30 text-warning",
                              t.temperatura.estado === 'critico' && "border-critical/30 text-critical",
                            )}>
                              {t.temperatura.estado}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All sales detail */}
            {period !== 'mes' && detailData?.todasLasVentas && detailData.todasLasVentas.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Todas las Ventas</CardTitle>
                    <Badge variant="secondary">{detailData.todasLasVentas.length} ventas</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {detailData.todasLasVentas.map((v, i) => (
                      <div key={`${v.id}-${i}`} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                        <div>
                          <p className="font-medium capitalize">{v.producto}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{v.hora}</span>
                            <Badge variant="outline" className="text-xs">{v.maquina}</Badge>
                          </div>
                        </div>
                        <span className="font-semibold text-primary">{v.precio.toFixed(2)}€</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
};
