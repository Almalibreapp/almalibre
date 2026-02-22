import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import {
  BarChart3, Euro, TrendingUp, Calendar, CreditCard, IceCream,
  Loader2, RefreshCw, ChevronLeft, ChevronRight, Package, Clock,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', '#8884d8', '#82ca9d', '#ffc658'];

export const AdminAnalytics = () => {
  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [syncing, setSyncing] = useState(false);

  // Fetch all machines
  const { data: maquinas } = useQuery({
    queryKey: ['admin-all-machines'],
    queryFn: async () => {
      const { data } = await supabase.from('maquinas').select('*').order('nombre_personalizado');
      return data || [];
    },
  });

  // Fetch historical sales for the selected month
  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: ventasHistorico, isLoading, refetch } = useQuery({
    queryKey: ['admin-ventas-historico', selectedMachine, monthStart, monthEnd],
    queryFn: async () => {
      let query = supabase
        .from('ventas_historico')
        .select('*')
        .gte('fecha', monthStart)
        .lte('fecha', monthEnd)
        .order('fecha', { ascending: true })
        .order('hora', { ascending: true });

      if (selectedMachine !== 'all') {
        query = query.eq('maquina_id', selectedMachine);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Sync sales from API
  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-ventas', {
        body: { dias_atras: 30 },
      });
      if (error) throw error;
      toast.success(`Sincronización completada: ${data?.results?.length || 0} registros procesados`);
      refetch();
    } catch (e: any) {
      toast.error(`Error en sincronización: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // === COMPUTED METRICS ===
  const metrics = useMemo(() => {
    if (!ventasHistorico || ventasHistorico.length === 0) {
      return {
        totalVentas: 0, totalEuros: 0, totalUnidades: 0, avgTicket: 0,
        ventasPorDia: [], ventasPorHora: [], ventasPorTopping: [],
        ventasPorMetodoPago: [], ventasPorProducto: [], ventasPorMaquina: [],
        calendarioDias: [], mejorDia: null, peorDia: null, mejorHora: null,
      };
    }

    const totalVentas = ventasHistorico.length;
    const totalEuros = ventasHistorico.reduce((sum, v) => sum + Number(v.precio), 0);
    const totalUnidades = ventasHistorico.reduce((sum, v) => sum + (v.cantidad_unidades || 1), 0);
    const avgTicket = totalVentas > 0 ? totalEuros / totalVentas : 0;

    // By day
    const byDay: Record<string, { ventas: number; euros: number; unidades: number }> = {};
    ventasHistorico.forEach(v => {
      if (!byDay[v.fecha]) byDay[v.fecha] = { ventas: 0, euros: 0, unidades: 0 };
      byDay[v.fecha].ventas++;
      byDay[v.fecha].euros += Number(v.precio);
      byDay[v.fecha].unidades += v.cantidad_unidades || 1;
    });
    const ventasPorDia = Object.entries(byDay)
      .map(([fecha, d]) => ({ fecha, label: format(new Date(fecha), 'dd MMM', { locale: es }), ...d }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    // By hour
    const byHour: Record<string, { ventas: number; euros: number }> = {};
    ventasHistorico.forEach(v => {
      const h = v.hora.split(':')[0] + ':00';
      if (!byHour[h]) byHour[h] = { ventas: 0, euros: 0 };
      byHour[h].ventas++;
      byHour[h].euros += Number(v.precio);
    });
    const ventasPorHora = Object.entries(byHour)
      .map(([hora, d]) => ({ hora, ...d }))
      .sort((a, b) => a.hora.localeCompare(b.hora));

    // By topping
    const byTopping: Record<string, number> = {};
    ventasHistorico.forEach(v => {
      const toppings = v.toppings as any[];
      if (toppings && Array.isArray(toppings)) {
        toppings.forEach((t: any) => {
          const name = t.nombre || t.posicion || 'Sin nombre';
          byTopping[name] = (byTopping[name] || 0) + 1;
        });
      }
    });
    const ventasPorTopping = Object.entries(byTopping)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    // By payment method
    const byPayment: Record<string, { ventas: number; euros: number }> = {};
    ventasHistorico.forEach(v => {
      const m = v.metodo_pago || 'efectivo';
      if (!byPayment[m]) byPayment[m] = { ventas: 0, euros: 0 };
      byPayment[m].ventas++;
      byPayment[m].euros += Number(v.precio);
    });
    const ventasPorMetodoPago = Object.entries(byPayment)
      .map(([metodo, d]) => ({ metodo: metodo.charAt(0).toUpperCase() + metodo.slice(1), ...d }))
      .sort((a, b) => b.ventas - a.ventas);

    // By product
    const byProduct: Record<string, { ventas: number; euros: number }> = {};
    ventasHistorico.forEach(v => {
      const p = v.producto || 'Sin nombre';
      if (!byProduct[p]) byProduct[p] = { ventas: 0, euros: 0 };
      byProduct[p].ventas++;
      byProduct[p].euros += Number(v.precio);
    });
    const ventasPorProducto = Object.entries(byProduct)
      .map(([producto, d]) => ({ producto, ...d }))
      .sort((a, b) => b.ventas - a.ventas);

    // By machine
    const byMachine: Record<string, { ventas: number; euros: number; nombre: string }> = {};
    ventasHistorico.forEach(v => {
      const maq = maquinas?.find(m => m.id === v.maquina_id);
      const key = v.maquina_id;
      if (!byMachine[key]) byMachine[key] = { ventas: 0, euros: 0, nombre: maq?.nombre_personalizado || v.imei };
      byMachine[key].ventas++;
      byMachine[key].euros += Number(v.precio);
    });
    const ventasPorMaquina = Object.entries(byMachine)
      .map(([id, d]) => ({ id, ...d }))
      .sort((a, b) => b.euros - a.euros);

    // Calendar
    const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
    const calendarioDias = daysInMonth.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayData = byDay[dateStr];
      return {
        fecha: dateStr,
        dia: format(day, 'd'),
        diaSemana: format(day, 'EEE', { locale: es }),
        ventas: dayData?.ventas || 0,
        euros: dayData?.euros || 0,
      };
    });

    const mejorDia = ventasPorDia.length > 0 ? ventasPorDia.reduce((best, d) => d.euros > best.euros ? d : best) : null;
    const peorDia = ventasPorDia.filter(d => d.ventas > 0).length > 0
      ? ventasPorDia.filter(d => d.ventas > 0).reduce((worst, d) => d.euros < worst.euros ? d : worst)
      : null;
    const mejorHora = ventasPorHora.length > 0 ? ventasPorHora.reduce((best, h) => h.ventas > best.ventas ? h : best) : null;

    return {
      totalVentas, totalEuros, totalUnidades, avgTicket,
      ventasPorDia, ventasPorHora, ventasPorTopping,
      ventasPorMetodoPago, ventasPorProducto, ventasPorMaquina,
      calendarioDias, mejorDia, peorDia, mejorHora,
    };
  }, [ventasHistorico, maquinas, currentMonth]);

  const navigateMonth = (dir: 'prev' | 'next') => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + (dir === 'prev' ? -1 : 1));
    setCurrentMonth(next);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Analytics de Ventas
          </h1>
          <p className="text-muted-foreground text-sm">Monitorización detallada de ventas por máquina</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMachine} onValueChange={setSelectedMachine}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todas las máquinas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las máquinas</SelectItem>
              {maquinas?.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.nombre_personalizado}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
            <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
        </div>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold capitalize min-w-[180px] text-center">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </h2>
        <Button variant="outline" size="sm" onClick={() => navigateMonth('next')} disabled={isSameMonth(currentMonth, new Date())}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : ventasHistorico && ventasHistorico.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium text-muted-foreground">Sin datos para este período</p>
            <p className="text-sm text-muted-foreground mt-1">Pulsa "Sincronizar" para importar ventas desde las máquinas</p>
            <Button onClick={handleSync} disabled={syncing} className="mt-4">
              <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
              Sincronizar ventas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Euro className="h-4 w-4" /> Facturación
                </div>
                <p className="text-2xl font-bold text-primary">{metrics.totalEuros.toFixed(2)}€</p>
                <p className="text-xs text-muted-foreground">{metrics.totalVentas} ventas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" /> Ticket Medio
                </div>
                <p className="text-2xl font-bold">{metrics.avgTicket.toFixed(2)}€</p>
                <p className="text-xs text-muted-foreground">por venta</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <IceCream className="h-4 w-4" /> Tarrinas
                </div>
                <p className="text-2xl font-bold">{metrics.totalUnidades}</p>
                <p className="text-xs text-muted-foreground">unidades vendidas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" /> Hora Punta
                </div>
                <p className="text-2xl font-bold">{metrics.mejorHora?.hora || '--'}</p>
                <p className="text-xs text-muted-foreground">{metrics.mejorHora?.ventas || 0} ventas</p>
              </CardContent>
            </Card>
          </div>

          {/* Highlights */}
          {(metrics.mejorDia || metrics.peorDia) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metrics.mejorDia && (
                <Card className="border-success/30 bg-success/5">
                  <CardContent className="p-4 flex items-center gap-3">
                    <ArrowUpRight className="h-5 w-5 text-success" />
                    <div>
                      <p className="text-sm font-medium">Mejor día</p>
                      <p className="text-lg font-bold">{metrics.mejorDia.label} — {metrics.mejorDia.euros.toFixed(2)}€ ({metrics.mejorDia.ventas} ventas)</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              {metrics.peorDia && (
                <Card className="border-warning/30 bg-warning/5">
                  <CardContent className="p-4 flex items-center gap-3">
                    <ArrowDownRight className="h-5 w-5 text-warning" />
                    <div>
                      <p className="text-sm font-medium">Día más flojo</p>
                      <p className="text-lg font-bold">{metrics.peorDia.label} — {metrics.peorDia.euros.toFixed(2)}€ ({metrics.peorDia.ventas} ventas)</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <Tabs defaultValue="daily" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="daily">Diario</TabsTrigger>
              <TabsTrigger value="hourly">Horario</TabsTrigger>
              <TabsTrigger value="toppings">Toppings</TabsTrigger>
              <TabsTrigger value="payments">Pagos</TabsTrigger>
              <TabsTrigger value="calendar">Calendario</TabsTrigger>
            </TabsList>

            {/* Daily Chart */}
            <TabsContent value="daily" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ventas diarias (€)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.ventasPorDia}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                          formatter={(v: number, name: string) => [name === 'euros' ? `${v.toFixed(2)}€` : v, name === 'euros' ? 'Ingresos' : 'Ventas']}
                        />
                        <Bar dataKey="euros" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Machine comparison */}
              {selectedMachine === 'all' && metrics.ventasPorMaquina.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ranking por Máquina</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {metrics.ventasPorMaquina.map((m, i) => (
                        <div key={m.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant={i === 0 ? 'default' : 'secondary'} className="w-7 h-7 rounded-full flex items-center justify-center p-0 text-xs">
                              {i + 1}
                            </Badge>
                            <span className="font-medium text-sm">{m.nombre}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{m.euros.toFixed(2)}€</p>
                            <p className="text-xs text-muted-foreground">{m.ventas} ventas</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Product breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Desglose por Producto</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {metrics.ventasPorProducto.map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                        <span className="text-sm truncate max-w-[60%]">{p.producto}</span>
                        <div className="text-right">
                          <span className="font-semibold text-sm">{p.euros.toFixed(2)}€</span>
                          <span className="text-xs text-muted-foreground ml-2">({p.ventas})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Hourly Chart */}
            <TabsContent value="hourly">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Distribución por Hora</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.ventasPorHora}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="hora" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                          formatter={(v: number, name: string) => [name === 'euros' ? `${v.toFixed(2)}€` : v, name === 'euros' ? 'Ingresos' : 'Ventas']}
                        />
                        <Bar dataKey="ventas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="ventas" />
                        <Bar dataKey="euros" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="euros" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Toppings */}
            <TabsContent value="toppings" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4" /> Popularidad de Toppings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={metrics.ventasPorTopping.slice(0, 8)}
                            cx="50%" cy="50%"
                            innerRadius={50} outerRadius={90}
                            dataKey="cantidad"
                            nameKey="nombre"
                            label={({ nombre, cantidad }) => `${nombre}: ${cantidad}`}
                          >
                            {metrics.ventasPorTopping.slice(0, 8).map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ranking de Toppings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {metrics.ventasPorTopping.map((t, i) => {
                        const max = metrics.ventasPorTopping[0]?.cantidad || 1;
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{t.nombre}</span>
                              <span className="font-semibold">{t.cantidad} usos</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${(t.cantidad / max) * 100}%`,
                                  backgroundColor: COLORS[i % COLORS.length],
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      {metrics.ventasPorTopping.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">Sin datos de toppings</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Payments */}
            <TabsContent value="payments" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="h-4 w-4" /> Métodos de Pago
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={metrics.ventasPorMetodoPago}
                            cx="50%" cy="50%"
                            innerRadius={50} outerRadius={90}
                            dataKey="ventas"
                            nameKey="metodo"
                            label={({ metodo, ventas }) => `${metodo}: ${ventas}`}
                          >
                            {metrics.ventasPorMetodoPago.map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Detalle por Método</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {metrics.ventasPorMetodoPago.map((m, i) => (
                        <div key={i} className="p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{m.metodo}</span>
                            <Badge variant="secondary">{((m.ventas / metrics.totalVentas) * 100).toFixed(1)}%</Badge>
                          </div>
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>{m.ventas} transacciones</span>
                            <span className="font-semibold text-foreground">{m.euros.toFixed(2)}€</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Calendar */}
            <TabsContent value="calendar">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Calendario de Ventas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-1">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                      <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
                    ))}
                    {/* Empty cells for first day offset */}
                    {(() => {
                      const firstDay = startOfMonth(currentMonth).getDay();
                      const offset = firstDay === 0 ? 6 : firstDay - 1;
                      return Array.from({ length: offset }).map((_, i) => (
                        <div key={`empty-${i}`} className="p-2" />
                      ));
                    })()}
                    {metrics.calendarioDias.map(day => {
                      const maxEuros = Math.max(...metrics.calendarioDias.map(d => d.euros), 1);
                      const intensity = day.euros > 0 ? Math.max(0.15, day.euros / maxEuros) : 0;
                      const isToday = day.fecha === format(new Date(), 'yyyy-MM-dd');
                      return (
                        <div
                          key={day.fecha}
                          className={cn(
                            "p-2 rounded-lg text-center transition-colors min-h-[60px] flex flex-col justify-center",
                            isToday && "ring-2 ring-primary",
                            day.ventas === 0 && "bg-muted/30"
                          )}
                          style={day.euros > 0 ? { backgroundColor: `hsl(var(--primary) / ${intensity})` } : undefined}
                        >
                          <span className={cn("text-xs font-medium", day.euros > 0 && intensity > 0.5 && "text-primary-foreground")}>
                            {day.dia}
                          </span>
                          {day.ventas > 0 && (
                            <>
                              <span className={cn("text-xs font-bold", intensity > 0.5 ? "text-primary-foreground" : "text-foreground")}>
                                {day.euros.toFixed(0)}€
                              </span>
                              <span className={cn("text-[10px]", intensity > 0.5 ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                {day.ventas}v
                              </span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};
