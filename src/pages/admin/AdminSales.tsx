import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { format, subDays, addDays, isToday as isTodayFn } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import {
  Euro, TrendingUp, Calendar, Loader2, ChevronLeft, ChevronRight,
  Clock, CreditCard, List, BarChart3,
} from 'lucide-react';

export const AdminSales = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('resumen');

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(selectedDate, 1), 'yyyy-MM-dd');

  // Fetch all machines
  const { data: maquinas } = useQuery({
    queryKey: ['admin-all-machines'],
    queryFn: async () => {
      const { data } = await supabase.from('maquinas').select('*').order('nombre_personalizado');
      return data || [];
    },
  });

  // Fetch sales for the selected day
  const { data: ventasDia, isLoading } = useQuery({
    queryKey: ['admin-ventas-dia', dateStr, selectedMachine],
    queryFn: async () => {
      let query = supabase
        .from('ventas_historico')
        .select('*')
        .eq('fecha', dateStr)
        .order('hora', { ascending: false });

      if (selectedMachine !== 'all') {
        query = query.eq('maquina_id', selectedMachine);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch yesterday sales for comparison
  const { data: ventasAyer } = useQuery({
    queryKey: ['admin-ventas-ayer', yesterdayStr, selectedMachine],
    queryFn: async () => {
      let query = supabase
        .from('ventas_historico')
        .select('precio')
        .eq('fecha', yesterdayStr);

      if (selectedMachine !== 'all') {
        query = query.eq('maquina_id', selectedMachine);
      }

      const { data } = await query;
      return data || [];
    },
  });

  // Computed metrics
  const metrics = useMemo(() => {
    if (!ventasDia) return null;

    const totalEuros = ventasDia.reduce((s, v) => s + Number(v.precio), 0);
    const totalVentas = ventasDia.length;
    const totalUnidades = ventasDia.reduce((s, v) => s + (v.cantidad_unidades || 1), 0);
    const avgTicket = totalVentas > 0 ? totalEuros / totalVentas : 0;

    const ayerEuros = ventasAyer?.reduce((s, v) => s + Number(v.precio), 0) || 0;
    const variacion = ayerEuros > 0 ? ((totalEuros - ayerEuros) / ayerEuros) * 100 : 0;

    // By hour
    const byHour: Record<string, { ventas: number; euros: number }> = {};
    ventasDia.forEach(v => {
      const h = v.hora.split(':')[0] + ':00';
      if (!byHour[h]) byHour[h] = { ventas: 0, euros: 0 };
      byHour[h].ventas++;
      byHour[h].euros += Number(v.precio);
    });
    const ventasPorHora = Object.entries(byHour)
      .map(([hora, d]) => ({ hora, ...d }))
      .sort((a, b) => a.hora.localeCompare(b.hora));

    const mejorHora = ventasPorHora.length > 0
      ? ventasPorHora.reduce((best, h) => h.ventas > best.ventas ? h : best)
      : null;

    // By machine
    const byMachine: Record<string, { ventas: number; euros: number; nombre: string }> = {};
    ventasDia.forEach(v => {
      const maq = maquinas?.find(m => m.id === v.maquina_id);
      const key = v.maquina_id;
      if (!byMachine[key]) byMachine[key] = { ventas: 0, euros: 0, nombre: maq?.nombre_personalizado || v.imei };
      byMachine[key].ventas++;
      byMachine[key].euros += Number(v.precio);
    });
    const ventasPorMaquina = Object.entries(byMachine)
      .map(([id, d]) => ({ id, ...d }))
      .sort((a, b) => b.euros - a.euros);

    // By payment method
    const byPayment: Record<string, number> = {};
    ventasDia.forEach(v => {
      const m = v.metodo_pago || 'efectivo';
      byPayment[m] = (byPayment[m] || 0) + 1;
    });

    return {
      totalEuros, totalVentas, totalUnidades, avgTicket,
      ayerEuros, variacion,
      ventasPorHora, mejorHora,
      ventasPorMaquina, byPayment,
    };
  }, [ventasDia, ventasAyer, maquinas]);

  const navigateDay = (dir: 'prev' | 'next') => {
    setSelectedDate(prev => dir === 'prev' ? subDays(prev, 1) : addDays(prev, 1));
  };

  const getMachineName = (maquinaId: string) => {
    return maquinas?.find(m => m.id === maquinaId)?.nombre_personalizado || '—';
  };

  const formatToppings = (toppings: any) => {
    if (!toppings || !Array.isArray(toppings) || toppings.length === 0) return '—';
    return toppings.map((t: any) => t.nombre || t.posicion).join(', ');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Euro className="h-6 w-6 text-primary" /> Ventas Globales
          </h1>
          <p className="text-muted-foreground text-sm">Desglose detallado de ventas por día</p>
        </div>
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
      </div>

      {/* Day Navigator */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigateDay('prev')}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center min-w-[200px]">
          <h2 className="text-lg font-semibold capitalize">
            {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
          </h2>
          <p className="text-xs text-muted-foreground">{dateStr}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigateDay('next')} disabled={isTodayFn(selectedDate)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !metrics || metrics.totalVentas === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Euro className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium text-muted-foreground">Sin ventas este día</p>
            <p className="text-sm text-muted-foreground mt-1">Navega a otro día con las flechas</p>
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
                {metrics.ayerEuros > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className={cn("h-3 w-3", metrics.variacion >= 0 ? 'text-success' : 'text-critical')} />
                    <span className={cn("text-xs", metrics.variacion >= 0 ? 'text-success' : 'text-critical')}>
                      {metrics.variacion >= 0 ? '+' : ''}{metrics.variacion.toFixed(0)}% vs ayer
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <List className="h-4 w-4" /> Ventas
                </div>
                <p className="text-2xl font-bold">{metrics.totalVentas}</p>
                <p className="text-xs text-muted-foreground">{metrics.totalUnidades} unidades</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" /> Ticket Medio
                </div>
                <p className="text-2xl font-bold">{metrics.avgTicket.toFixed(2)}€</p>
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

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="detalle">Ventas Individuales</TabsTrigger>
              <TabsTrigger value="horario">Por Hora</TabsTrigger>
            </TabsList>

            {/* Resumen Tab */}
            <TabsContent value="resumen" className="space-y-4">
              {/* Hourly chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Actividad del día (€)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.ventasPorHora}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="hora" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                          formatter={(v: number, name: string) => [name === 'euros' ? `${v.toFixed(2)}€` : v, name === 'euros' ? 'Ingresos' : 'Ventas']}
                        />
                        <Bar dataKey="euros" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="euros" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Machine ranking */}
              {selectedMachine === 'all' && metrics.ventasPorMaquina.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ranking por Máquina</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {metrics.ventasPorMaquina.map((m, i) => (
                      <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <Badge variant={i === 0 ? 'default' : 'secondary'} className="w-7 h-7 rounded-full flex items-center justify-center p-0 text-xs">
                            {i + 1}
                          </Badge>
                          <span className="font-medium text-sm">{m.nombre}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">{m.euros.toFixed(2)}€</p>
                          <p className="text-xs text-muted-foreground">{m.ventas} ventas</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Payment methods summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4" /> Métodos de Pago
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(metrics.byPayment).map(([method, count]) => (
                      <Badge key={method} variant="secondary" className="text-sm py-1 px-3">
                        {method.charAt(0).toUpperCase() + method.slice(1)}: {count}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Detalle Tab - Individual sales */}
            <TabsContent value="detalle">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <List className="h-4 w-4" /> Todas las ventas — {format(selectedDate, "d MMM yyyy", { locale: es })}
                    <Badge variant="secondary" className="ml-auto">{ventasDia?.length || 0} ventas</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[70px]">Hora</TableHead>
                          {selectedMachine === 'all' && <TableHead>Máquina</TableHead>}
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Precio</TableHead>
                          <TableHead className="text-right">Uds.</TableHead>
                          <TableHead>Pago</TableHead>
                          <TableHead>Toppings</TableHead>
                          <TableHead>Orden</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ventasDia?.map(v => (
                          <TableRow key={v.id}>
                            <TableCell className="font-mono text-xs">{v.hora}</TableCell>
                            {selectedMachine === 'all' && (
                              <TableCell className="text-xs">{getMachineName(v.maquina_id)}</TableCell>
                            )}
                            <TableCell className="font-medium text-sm max-w-[150px] truncate">{v.producto}</TableCell>
                            <TableCell className="text-right font-bold text-primary">{Number(v.precio).toFixed(2)}€</TableCell>
                            <TableCell className="text-right">{v.cantidad_unidades || 1}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {(v.metodo_pago || 'efectivo').charAt(0).toUpperCase() + (v.metodo_pago || 'efectivo').slice(1)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                              {formatToppings(v.toppings)}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{v.numero_orden || '—'}</TableCell>
                            <TableCell>
                              <Badge variant={v.estado === 'exitoso' ? 'default' : 'destructive'} className="text-xs">
                                {v.estado}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Hourly breakdown Tab */}
            <TabsContent value="horario">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Desglose por Hora</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 w-full mb-6">
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
                  <div className="space-y-2">
                    {metrics.ventasPorHora.map(h => (
                      <div key={h.hora} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono font-medium">{h.hora}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">{h.ventas} ventas</span>
                          <span className="font-bold text-primary">{h.euros.toFixed(2)}€</span>
                        </div>
                      </div>
                    ))}
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
