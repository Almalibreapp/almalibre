import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { convertirHoraSegunMaquina, extraerFechaVenta } from '@/lib/timezone-utils';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { DashboardSkeleton, VentasSkeleton } from '@/components/ui/sales-skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { format, subDays, addDays, isToday as isTodayFn } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { fetchOrdenes } from '@/services/api';
import { fetchSpanishDayOrders } from '@/lib/sales';
import { useVentasRealtime } from '@/hooks/useVentasRealtime';
import {
  Euro, TrendingUp, Calendar, ChevronLeft, ChevronRight,
  Clock, CreditCard, List, BarChart3, IceCream, Target,
} from 'lucide-react';

const decodeHtmlEntities = (text: string) => {
  if (!text) return '';
  if (typeof window === 'undefined') {
    return text
      .replace(/&ccedil;/g, 'ç').replace(/&ntilde;/g, 'ñ')
      .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é')
      .replace(/&iacute;/g, 'í').replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú');
  }
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

const normalizePaymentMethod = (method?: string | null) => {
  const raw = decodeHtmlEntities(method || '').trim().toLowerCase();
  if (!raw) return 'efectivo';
  if (raw.includes('tarjeta') || raw.includes('card') || raw.includes('credito') || raw.includes('débito') || raw.includes('debito')) return 'tarjeta';
  if (raw.includes('bizum')) return 'bizum';
  if (raw.includes('apple')) return 'apple pay';
  if (raw.includes('google')) return 'google pay';
  if (raw.includes('cash') || raw.includes('efectivo') || raw.includes('metalico') || raw.includes('metálico')) return 'efectivo';
  return raw;
};

const parseProductAndToppings = (productText?: string | null) => {
  const decoded = decodeHtmlEntities(productText || '').trim();
  if (!decoded) return { productName: 'Sin nombre', toppings: [] as string[] };
  const [baseProduct, toppingsText] = decoded.split(':');
  const toppings = (toppingsText || '').split(',').map((t) => t.trim()).filter(Boolean);
  return { productName: (baseProduct || decoded).trim(), toppings };
};

export const AdminSales = () => {
  useVentasRealtime();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('resumen');

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(selectedDate, 1), 'yyyy-MM-dd');

  const { data: maquinas } = useQuery({
    queryKey: ['admin-all-machines'],
    queryFn: async () => {
      const { data } = await supabase.from('maquinas').select('*').order('nombre_personalizado');
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: ventasDiaRaw, isLoading } = useQuery({
    queryKey: ['admin-ventas-dia', dateStr, selectedMachine, maquinas?.map(m => m.id).join(',')],
    queryFn: async () => {
      if (isTodayFn(selectedDate) && maquinas && maquinas.length > 0) {
        const targetMachines = selectedMachine === 'all' ? maquinas : maquinas.filter((m) => m.id === selectedMachine);
        const apiPromises = targetMachines.map(async (m) => {
          try {
            const sales = await fetchSpanishDayOrders(m.mac_address, dateStr, fetchOrdenes);
            return sales.map((v: any) => {
              const fhc = v.fecha_hora_china || '';
              const hora = fhc ? convertirHoraSegunMaquina(fhc, m.mac_address) : (v.horaSpain || v.hora || '00:00');
              const fecha = fhc ? extraerFechaVenta(fhc) : (v.fechaSpain || v.fecha || dateStr);
              return {
                id: `api-${m.id}-${v.saleUid || v.id}`,
                sale_uid: v.saleUid || v.id,
                maquina_id: m.id, imei: m.mac_address,
                fecha, hora,
                producto: v.producto || '', precio: Number(v.precio || 0),
                cantidad_unidades: v.cantidad_unidades || v.cantidad || 1,
                metodo_pago: v.metodo_pago || 'efectivo',
                numero_orden: v.numero_orden || null,
                estado: v.estado || 'exitoso', toppings: v.toppings || [],
                fecha_hora_china: fhc,
              };
            });
          } catch { return []; }
        });
        const results = await Promise.allSettled(apiPromises);
        const allSales = results.filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled').flatMap((r) => r.value);
        const seen = new Set<string>();
        return allSales.filter(v => { const key = String(v.sale_uid || v.id); if (seen.has(key)) return false; seen.add(key); return true; });
      }
      let query = supabase.from('ventas_historico').select('*').eq('fecha', dateStr).order('hora', { ascending: false });
      if (selectedMachine !== 'all') query = query.eq('maquina_id', selectedMachine);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: isTodayFn(selectedDate) ? 30000 : false,
    refetchOnWindowFocus: true,
  });

  const ventasDia = useMemo(() => {
    if (!ventasDiaRaw) return [];
    return ventasDiaRaw.filter(v => (v.fecha || '').substring(0, 10) === dateStr);
  }, [ventasDiaRaw, dateStr]);

  const { data: ventasAyerRaw } = useQuery({
    queryKey: ['admin-ventas-ayer', yesterdayStr, selectedMachine],
    queryFn: async () => {
      let query = supabase.from('ventas_historico').select('precio, hora, fecha').eq('fecha', yesterdayStr);
      if (selectedMachine !== 'all') query = query.eq('maquina_id', selectedMachine);
      const { data } = await query;
      return data || [];
    },
    refetchInterval: isTodayFn(selectedDate) ? 30000 : false,
  });

  const ventasAyer = useMemo(() => ventasAyerRaw || [], [ventasAyerRaw]);

  const metrics = useMemo(() => {
    if (!ventasDia) return null;
    const totalEuros = ventasDia.reduce((s, v) => s + Number(v.precio), 0);
    const totalVentas = ventasDia.length;
    const totalUnidades = ventasDia.reduce((s, v) => s + (v.cantidad_unidades || 1), 0);
    const avgTicket = totalVentas > 0 ? totalEuros / totalVentas : 0;
    const ayerEuros = ventasAyer?.reduce((s, v) => s + Number(v.precio), 0) || 0;
    const variacion = ayerEuros > 0 ? ((totalEuros - ayerEuros) / ayerEuros) * 100 : 0;

    const byHour: Record<string, { ventas: number; euros: number }> = {};
    ventasDia.forEach(v => {
      const horaDisplay = v.fecha_hora_china ? convertirHoraSegunMaquina(v.fecha_hora_china, v.imei || '') : (v.hora || '00:00');
      const h = horaDisplay.split(':')[0] + ':00';
      if (!byHour[h]) byHour[h] = { ventas: 0, euros: 0 };
      byHour[h].ventas++;
      byHour[h].euros += Number(v.precio);
    });
    const ventasPorHora = Object.entries(byHour).map(([hora, d]) => ({ hora, ...d })).sort((a, b) => a.hora.localeCompare(b.hora));
    const mejorHora = ventasPorHora.length > 0 ? ventasPorHora.reduce((best, h) => h.ventas > best.ventas ? h : best) : null;

    const byMachine: Record<string, { ventas: number; euros: number; nombre: string }> = {};
    ventasDia.forEach(v => {
      const maq = maquinas?.find(m => m.id === v.maquina_id);
      const key = v.maquina_id;
      if (!byMachine[key]) byMachine[key] = { ventas: 0, euros: 0, nombre: maq?.nombre_personalizado || v.imei };
      byMachine[key].ventas++;
      byMachine[key].euros += Number(v.precio);
    });
    const ventasPorMaquina = Object.entries(byMachine).map(([id, d]) => ({ id, ...d })).sort((a, b) => b.euros - a.euros);

    const byPayment: Record<string, number> = {};
    ventasDia.forEach(v => {
      const m = normalizePaymentMethod(v.metodo_pago);
      byPayment[m] = (byPayment[m] || 0) + 1;
    });

    return { totalEuros, totalVentas, totalUnidades, avgTicket, ayerEuros, variacion, ventasPorHora, mejorHora, ventasPorMaquina, byPayment };
  }, [ventasDia, ventasAyer, maquinas]);

  const navigateDay = (dir: 'prev' | 'next') => {
    setSelectedDate(prev => dir === 'prev' ? subDays(prev, 1) : addDays(prev, 1));
  };

  const getMachineName = (maquinaId: string) => maquinas?.find(m => m.id === maquinaId)?.nombre_personalizado || '—';

  const formatToppings = (toppings: any, producto?: string) => {
    if (Array.isArray(toppings) && toppings.length > 0) return toppings.map((t: any) => decodeHtmlEntities(t.nombre || t.posicion)).join(', ');
    const parsed = parseProductAndToppings(producto);
    if (parsed.toppings.length > 0) return parsed.toppings.join(', ');
    return '—';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header con gradiente */}
      <div className="rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-primary/70 p-8 text-primary-foreground">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-3">
              <Euro className="h-8 w-8" /> Ventas Globales
            </h1>
            <p className="text-primary-foreground/70 mt-1">Desglose detallado de ventas por día</p>
          </div>
          <Select value={selectedMachine} onValueChange={setSelectedMachine}>
            <SelectTrigger className="w-[200px] bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
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
      </div>

      {/* Day Navigator */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigateDay('prev')} className="rounded-full h-10 w-10">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center min-w-[220px] px-6 py-3 rounded-xl bg-muted/50 border">
          <h2 className="text-lg font-semibold capitalize">
            {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
          </h2>
          <p className="text-xs text-muted-foreground">{dateStr}</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => navigateDay('next')} disabled={isTodayFn(selectedDate)} className="rounded-full h-10 w-10">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : !metrics || metrics.totalVentas === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Euro className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold text-muted-foreground">Sin ventas este día</p>
            <p className="text-sm text-muted-foreground mt-1">Navega a otro día con las flechas</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Facturación"
              value={`${metrics.totalEuros.toFixed(2)}€`}
              icon={<Euro className="h-6 w-6" />}
              change={metrics.ayerEuros > 0 ? Math.round(metrics.variacion) : undefined}
              trend={metrics.variacion >= 0 ? 'up' : 'down'}
            />
            <StatCard
              title="Ventas"
              value={`${metrics.totalVentas} (${metrics.totalUnidades} uds)`}
              icon={<IceCream className="h-6 w-6" />}
            />
            <StatCard
              title="Ticket Medio"
              value={`${metrics.avgTicket.toFixed(2)}€`}
              icon={<Target className="h-6 w-6" />}
            />
            <StatCard
              title="Hora Punta"
              value={metrics.mejorHora?.hora || '--'}
              icon={<Clock className="h-6 w-6" />}
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="detalle">Ventas Individuales</TabsTrigger>
              <TabsTrigger value="horario">Por Hora</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Actividad del día (€)</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.ventasPorHora}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="hora" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number, name: string) => [name === 'euros' ? `${v.toFixed(2)}€` : v, name === 'euros' ? 'Ingresos' : 'Ventas']} />
                        <Bar dataKey="euros" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="euros" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {selectedMachine === 'all' && metrics.ventasPorMaquina.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Ranking por Máquina</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {metrics.ventasPorMaquina.map((m, i) => (
                      <div key={m.id} className="flex items-center justify-between py-3 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                            i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}>
                            {i + 1}
                          </div>
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4" /> Métodos de Pago
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(metrics.byPayment).map(([method, count]) => (
                      <Badge key={method} variant="secondary" className="text-sm py-1.5 px-4">
                        {decodeHtmlEntities(method).charAt(0).toUpperCase() + decodeHtmlEntities(method).slice(1)}: {count}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="detalle">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <List className="h-4 w-4" /> Todas las ventas — {format(selectedDate, "d MMM yyyy", { locale: es })}
                    <Badge variant="secondary" className="ml-auto">{ventasDia?.length || 0}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
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
                          <TableRow key={v.id} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="font-mono text-xs">{v.fecha_hora_china ? convertirHoraSegunMaquina(v.fecha_hora_china, v.imei || '') : (v.hora || '00:00').substring(0, 5)}</TableCell>
                            {selectedMachine === 'all' && <TableCell className="text-xs">{getMachineName(v.maquina_id)}</TableCell>}
                            <TableCell className="font-medium text-sm max-w-[150px] truncate">{parseProductAndToppings(v.producto).productName}</TableCell>
                            <TableCell className="text-right font-bold text-primary">{Number(v.precio).toFixed(2)}€</TableCell>
                            <TableCell className="text-right">{v.cantidad_unidades || 1}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {(() => { const method = normalizePaymentMethod(v.metodo_pago); return method.charAt(0).toUpperCase() + method.slice(1); })()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{formatToppings(v.toppings, v.producto)}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{v.numero_orden || '—'}</TableCell>
                            <TableCell>
                              <Badge variant={v.estado === 'exitoso' ? 'success' : 'destructive'} className="text-xs">{v.estado}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="horario">
              <Card>
                <CardHeader><CardTitle className="text-base">Desglose por Hora</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64 w-full mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.ventasPorHora}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="hora" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number, name: string) => [name === 'euros' ? `${v.toFixed(2)}€` : v, name === 'euros' ? 'Ingresos' : 'Ventas']} />
                        <Bar dataKey="ventas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="ventas" />
                        <Bar dataKey="euros" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="euros" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {metrics.ventasPorHora.map(h => (
                      <div key={h.hora} className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-muted/50 transition-colors border-b last:border-0">
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
