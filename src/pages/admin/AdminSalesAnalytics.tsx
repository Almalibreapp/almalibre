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
import { format, subDays, addDays, isToday as isTodayFn, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
// API returns times already in Spain local time — no timezone conversion needed
import { fetchOrdenes } from '@/services/api';
import { useVentasRealtime } from '@/hooks/useVentasRealtime';
import { toast } from 'sonner';
import {
  Euro, TrendingUp, Calendar, Loader2, ChevronLeft, ChevronRight,
  Clock, CreditCard, List, BarChart3, IceCream, Package, RefreshCw,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

/**
 * Fetch sales from API for a given China date, convert to Spain date,
 * and tag each sale with its real Spanish date.
 */
const fetchDaySalesRaw = async (imei: string, maquinaId: string, apiDate: string) => {
  try {
    const detalle = await fetchOrdenes(imei, apiDate);
    if (!detalle?.ventas) return [];
    return detalle.ventas.map((v: any) => {
      const fecha = (v.fecha || detalle.fecha || apiDate).substring(0, 10);
      const hora = v.hora || '00:00';
      return {
        id: v.id || v.numero_orden || `${maquinaId}-${apiDate}-${hora}-${v.precio}-${Math.random()}`,
        maquina_id: maquinaId,
        imei,
        fecha,
        fechaSpain: fecha,
        hora,
        horaSpain: hora,
        producto: v.producto || '',
        precio: Number(v.precio || 0),
        cantidad_unidades: v.cantidad_unidades || v.cantidad || 1,
        metodo_pago: v.metodo_pago || 'efectivo',
        numero_orden: v.numero_orden || null,
        estado: v.estado || 'exitoso',
        toppings: v.toppings || [],
      };
    });
  } catch { return []; }
};

/**
 * Fetch sales for a given date. API returns dates/times in Spain local time,
 * so no timezone conversion or dual-date fetching is needed.
 */
const fetchSpanishDaySales = async (imei: string, maquinaId: string, spanishDate: string) => {
  return fetchDaySalesRaw(imei, maquinaId, spanishDate);
};

/** Helper: deduplicate sales by unique sale ID */
const deduplicateSales = (sales: any[]) => {
  const seen = new Set<string>();
  return sales.filter(v => {
    const key = v.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** Format local date as YYYY-MM-DD without UTC conversion */
const formatLocal = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', '#8884d8', '#82ca9d', '#ffc658'];

const decodeHtmlEntities = (text: string) => {
  if (!text) return '';
  if (typeof window === 'undefined') {
    return text.replace(/&ccedil;/g, 'ç').replace(/&ntilde;/g, 'ñ').replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í').replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú');
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
  const toppings = (toppingsText || '').split(',').map(t => t.trim()).filter(Boolean);
  return { productName: (baseProduct || decoded).trim(), toppings };
};

export const AdminSalesAnalytics = () => {
  useVentasRealtime();
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('resumen');
  const [syncing, setSyncing] = useState(false);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(selectedDate, 1), 'yyyy-MM-dd');
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: maquinas } = useQuery({
    queryKey: ['admin-all-machines'],
    queryFn: async () => {
      const { data } = await supabase.from('maquinas').select('*').order('nombre_personalizado');
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // ============ DAILY VIEW DATA ============
  // Fetch both dateStr and dateStr+1 from API, filter by Spanish date
  const { data: ventasDia = [], isLoading: loadingDaily, refetch: refetchDaily } = useQuery({
    queryKey: ['admin-ventas-dia', dateStr, selectedMachine, maquinas?.map(m => m.id).join(',')],
    queryFn: async () => {
      if (!maquinas || maquinas.length === 0) return [];
      const targetMachines = selectedMachine === 'all'
        ? maquinas
        : maquinas.filter(m => m.id === selectedMachine);
      const uniqueByImei = Array.from(new Map(targetMachines.map(m => [m.mac_address, m])).values());

      const allSales = await Promise.all(
        uniqueByImei.map(m => fetchSpanishDaySales(m.mac_address, m.id, dateStr))
      );
      return deduplicateSales(allSales.flat());
    },
    refetchInterval: isTodayFn(selectedDate) ? 30000 : false,
    enabled: viewMode === 'daily' && !!maquinas && maquinas.length > 0,
  });

  // Yesterday for comparison
  const { data: ventasAyer = [] } = useQuery({
    queryKey: ['admin-ventas-ayer', yesterdayStr, selectedMachine, maquinas?.map(m => m.id).join(',')],
    queryFn: async () => {
      if (!maquinas || maquinas.length === 0) return [];
      const targetMachines = selectedMachine === 'all'
        ? maquinas
        : maquinas.filter(m => m.id === selectedMachine);
      const uniqueByImei = Array.from(new Map(targetMachines.map(m => [m.mac_address, m])).values());
      const allSales = await Promise.all(
        uniqueByImei.map(m => fetchSpanishDaySales(m.mac_address, m.id, yesterdayStr))
      );
      return deduplicateSales(allSales.flat());
    },
    enabled: viewMode === 'daily' && !!maquinas && maquinas.length > 0,
  });

  // ============ MONTHLY VIEW DATA ============
  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
  const isCurrentMonth = isSameMonth(currentMonth, new Date());

  const { data: ventasHistorico, isLoading: loadingMonthly, refetch: refetchMonthly } = useQuery({
    queryKey: ['admin-ventas-historico', selectedMachine, monthStart, monthEnd, maquinas?.map(m => m.id).join(',')],
    queryFn: async () => {
      if (!maquinas || maquinas.length === 0) return [];
      const targetMachines = selectedMachine === 'all'
        ? maquinas
        : maquinas.filter(m => m.id === selectedMachine);
      const uniqueByImei = Array.from(new Map(targetMachines.map(m => [m.mac_address, m])).values());

      // API dates are already Spain dates, no extra day needed
      const lastDay = endOfMonth(currentMonth);
      const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: lastDay });
      const apiDates = days.map(d => formatLocal(d));

      // Fetch each API date from API for each machine
      const allSales = await Promise.all(
        uniqueByImei.flatMap(m =>
          apiDates.map(fecha => fetchDaySalesRaw(m.mac_address, m.id, fecha))
        )
      );

      // Filter: only keep sales whose Spanish date falls within the month
      const monthDays = eachDayOfInterval({ start: startOfMonth(currentMonth), end: lastDay });
      const validDates = new Set(monthDays.map(d => formatLocal(d)));
      return deduplicateSales(allSales.flat().filter(s => validDates.has(s.fechaSpain)));
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: isCurrentMonth ? 60000 : false,
    enabled: viewMode === 'monthly' && !!maquinas && maquinas.length > 0,
  });

  // Refresh handler — works for both daily and monthly
  const handleRefresh = async () => {
    setSyncing(true);
    try {
      if (viewMode === 'monthly') {
        const { data, error } = await supabase.functions.invoke('sync-ventas', { body: { dias_atras: 30 } });
        if (error) throw error;
        toast.success(`Sincronización completada: ${data?.results?.length || 0} registros`);
        refetchMonthly();
      } else {
        await refetchDaily();
        toast.success('Datos actualizados');
      }
    } catch (e: any) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // ============ DAILY METRICS ============
  const dailyMetrics = useMemo(() => {
    if (!ventasDia || ventasDia.length === 0) return null;
    const totalEuros = ventasDia.reduce((s, v) => s + Number(v.precio), 0);
    const totalVentas = ventasDia.length;
    const totalUnidades = ventasDia.reduce((s, v) => s + (v.cantidad_unidades || 1), 0);
    const avgTicket = totalVentas > 0 ? totalEuros / totalVentas : 0;
    const ayerEuros = ventasAyer?.reduce((s, v) => s + Number(v.precio), 0) || 0;
    const variacion = ayerEuros > 0 ? ((totalEuros - ayerEuros) / ayerEuros) * 100 : 0;

    const byHour: Record<string, { ventas: number; euros: number }> = {};
    ventasDia.forEach(v => {
      const h = v.horaSpain.split(':')[0] + ':00';
      if (!byHour[h]) byHour[h] = { ventas: 0, euros: 0 };
      byHour[h].ventas++;
      byHour[h].euros += Number(v.precio);
    });
    const ventasPorHora = Object.entries(byHour).map(([hora, d]) => ({ hora, ...d })).sort((a, b) => a.hora.localeCompare(b.hora));
    const mejorHora = ventasPorHora.length > 0 ? ventasPorHora.reduce((best, h) => h.ventas > best.ventas ? h : best) : null;

    const byMachine: Record<string, { ventas: number; euros: number; nombre: string }> = {};
    ventasDia.forEach(v => {
      const maq = maquinas?.find(m => m.id === v.maquina_id);
      if (!byMachine[v.maquina_id]) byMachine[v.maquina_id] = { ventas: 0, euros: 0, nombre: maq?.nombre_personalizado || '' };
      byMachine[v.maquina_id].ventas++;
      byMachine[v.maquina_id].euros += Number(v.precio);
    });
    const ventasPorMaquina = Object.entries(byMachine).map(([id, d]) => ({ id, ...d })).sort((a, b) => b.euros - a.euros);

    const byPayment: Record<string, number> = {};
    ventasDia.forEach(v => { const m = normalizePaymentMethod(v.metodo_pago); byPayment[m] = (byPayment[m] || 0) + 1; });

    return { totalEuros, totalVentas, totalUnidades, avgTicket, ayerEuros, variacion, ventasPorHora, mejorHora, ventasPorMaquina, byPayment };
  }, [ventasDia, ventasAyer, maquinas]);

  // ============ MONTHLY METRICS ============
  const ventasNormalizadas = useMemo(() => {
    if (!ventasHistorico) return [];
    return ventasHistorico.map(v => {
      // fechaSpain and horaSpain are already computed in fetchDaySalesRaw
      const productInfo = parseProductAndToppings(v.producto);
      const toppingNames = Array.isArray(v.toppings) && v.toppings.length > 0
        ? v.toppings.map((t: any) => decodeHtmlEntities(t.nombre || t.posicion || '')).filter(Boolean)
        : productInfo.toppings;
      return { ...v, saleDate: new Date(`${v.fechaSpain}T00:00:00`), productoNormalizado: productInfo.productName, toppingNames, metodoPagoNormalizado: normalizePaymentMethod(v.metodo_pago) };
    });
  }, [ventasHistorico, currentMonth]);

  const monthlyMetrics = useMemo(() => {
    if (!ventasNormalizadas.length) return null;
    const totalVentas = ventasNormalizadas.length;
    const totalEuros = ventasNormalizadas.reduce((s, v) => s + Number(v.precio), 0);
    const totalUnidades = ventasNormalizadas.reduce((s, v) => s + (v.cantidad_unidades || 1), 0);
    const avgTicket = totalVentas > 0 ? totalEuros / totalVentas : 0;

    const byDay: Record<string, { ventas: number; euros: number }> = {};
    ventasNormalizadas.forEach(v => {
      if (!byDay[v.fechaSpain]) byDay[v.fechaSpain] = { ventas: 0, euros: 0 };
      byDay[v.fechaSpain].ventas++;
      byDay[v.fechaSpain].euros += Number(v.precio);
    });
    const ventasPorDia = Object.entries(byDay).map(([fecha, d]) => ({ fecha, label: format(new Date(`${fecha}T00:00:00`), 'dd MMM', { locale: es }), ...d })).sort((a, b) => a.fecha.localeCompare(b.fecha));

    const byHour: Record<string, { ventas: number; euros: number }> = {};
    ventasNormalizadas.forEach(v => { const h = v.horaSpain.split(':')[0] + ':00'; if (!byHour[h]) byHour[h] = { ventas: 0, euros: 0 }; byHour[h].ventas++; byHour[h].euros += Number(v.precio); });
    const ventasPorHora = Object.entries(byHour).map(([hora, d]) => ({ hora, ...d })).sort((a, b) => a.hora.localeCompare(b.hora));

    const byTopping: Record<string, number> = {};
    ventasNormalizadas.forEach(v => v.toppingNames.forEach((n: string) => { byTopping[n] = (byTopping[n] || 0) + 1; }));
    const ventasPorTopping = Object.entries(byTopping).map(([nombre, cantidad]) => ({ nombre, cantidad })).sort((a, b) => b.cantidad - a.cantidad);

    const byPayment: Record<string, { ventas: number; euros: number }> = {};
    ventasNormalizadas.forEach(v => { const m = v.metodoPagoNormalizado; if (!byPayment[m]) byPayment[m] = { ventas: 0, euros: 0 }; byPayment[m].ventas++; byPayment[m].euros += Number(v.precio); });
    const ventasPorMetodoPago = Object.entries(byPayment).map(([metodo, d]) => ({ metodo: metodo.charAt(0).toUpperCase() + metodo.slice(1), ...d })).sort((a, b) => b.ventas - a.ventas);

    const byProduct: Record<string, { ventas: number; euros: number }> = {};
    ventasNormalizadas.forEach(v => { const p = v.productoNormalizado || 'Sin nombre'; if (!byProduct[p]) byProduct[p] = { ventas: 0, euros: 0 }; byProduct[p].ventas++; byProduct[p].euros += Number(v.precio); });
    const ventasPorProducto = Object.entries(byProduct).map(([producto, d]) => ({ producto, ...d })).sort((a, b) => b.ventas - a.ventas);

    const mejorHora = ventasPorHora.length > 0 ? ventasPorHora.reduce((b, h) => h.ventas > b.ventas ? h : b) : null;
    const mejorDia = ventasPorDia.length > 0 ? ventasPorDia.reduce((b, d) => d.euros > b.euros ? d : b) : null;
    const peorDia = ventasPorDia.filter(d => d.ventas > 0).length > 0 ? ventasPorDia.filter(d => d.ventas > 0).reduce((w, d) => d.euros < w.euros ? d : w) : null;

    const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
    const calendarioDias = daysInMonth.map(day => {
      const ds = format(day, 'yyyy-MM-dd');
      const dayData = byDay[ds];
      return { fecha: ds, dia: format(day, 'd'), ventas: dayData?.ventas || 0, euros: dayData?.euros || 0 };
    });

    return { totalVentas, totalEuros, totalUnidades, avgTicket, ventasPorDia, ventasPorHora, ventasPorTopping, ventasPorMetodoPago, ventasPorProducto, mejorHora, mejorDia, peorDia, calendarioDias };
  }, [ventasNormalizadas, currentMonth]);

  const navigateDay = (dir: 'prev' | 'next') => setSelectedDate(prev => dir === 'prev' ? subDays(prev, 1) : addDays(prev, 1));
  const navigateMonth = (dir: 'prev' | 'next') => { const next = new Date(currentMonth); next.setMonth(next.getMonth() + (dir === 'prev' ? -1 : 1)); setCurrentMonth(next); };
  const getMachineName = (id: string) => maquinas?.find(m => m.id === id)?.nombre_personalizado || '—';

  const formatToppings = (toppings: any, producto?: string) => {
    if (Array.isArray(toppings) && toppings.length > 0) return toppings.map((t: any) => decodeHtmlEntities(t.nombre || t.posicion)).join(', ');
    const parsed = parseProductAndToppings(producto);
    return parsed.toppings.length > 0 ? parsed.toppings.join(', ') : '—';
  };

  const isLoading = viewMode === 'daily' ? loadingDaily : loadingMonthly;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Ventas y Análisis
          </h1>
          <p className="text-muted-foreground text-sm">Desglose detallado de ventas</p>
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
          <Button onClick={handleRefresh} disabled={syncing} variant="outline" size="sm">
            <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
            {syncing ? 'Actualizando...' : 'Actualizar'}
          </Button>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center justify-center gap-2">
        <Button variant={viewMode === 'daily' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('daily')}>
          <Calendar className="h-4 w-4 mr-1" /> Vista Diaria
        </Button>
        <Button variant={viewMode === 'monthly' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('monthly')}>
          <BarChart3 className="h-4 w-4 mr-1" /> Vista Mensual
        </Button>
      </div>

      {/* Navigator */}
      {viewMode === 'daily' ? (
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigateDay('prev')}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="text-center min-w-[200px]">
            <h2 className="text-lg font-semibold capitalize">{format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}</h2>
            <p className="text-xs text-muted-foreground">{dateStr}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigateDay('next')} disabled={isTodayFn(selectedDate)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="text-lg font-semibold capitalize min-w-[180px] text-center">{format(currentMonth, 'MMMM yyyy', { locale: es })}</h2>
          <Button variant="outline" size="sm" onClick={() => navigateMonth('next')} disabled={isSameMonth(currentMonth, new Date())}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : viewMode === 'daily' ? (
        /* =================== DAILY VIEW =================== */
        !dailyMetrics || dailyMetrics.totalVentas === 0 ? (
          <Card><CardContent className="py-12 text-center"><Euro className="h-12 w-12 mx-auto mb-4 opacity-30" /><p className="text-lg font-medium text-muted-foreground">Sin ventas este día</p></CardContent></Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Euro className="h-4 w-4" /> Facturación</div>
                <p className="text-2xl font-bold text-primary">{dailyMetrics.totalEuros.toFixed(2)}€</p>
                {dailyMetrics.ayerEuros > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className={cn("h-3 w-3", dailyMetrics.variacion >= 0 ? 'text-success' : 'text-critical')} />
                    <span className={cn("text-xs", dailyMetrics.variacion >= 0 ? 'text-success' : 'text-critical')}>{dailyMetrics.variacion >= 0 ? '+' : ''}{dailyMetrics.variacion.toFixed(0)}% vs ayer</span>
                  </div>
                )}
              </CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><List className="h-4 w-4" /> Ventas</div><p className="text-2xl font-bold">{dailyMetrics.totalVentas}</p><p className="text-xs text-muted-foreground">{dailyMetrics.totalUnidades} unidades</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><TrendingUp className="h-4 w-4" /> Ticket Medio</div><p className="text-2xl font-bold">{dailyMetrics.avgTicket.toFixed(2)}€</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Clock className="h-4 w-4" /> Hora Punta</div><p className="text-2xl font-bold">{dailyMetrics.mejorHora?.hora || '--'}</p><p className="text-xs text-muted-foreground">{dailyMetrics.mejorHora?.ventas || 0} ventas</p></CardContent></Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="resumen">Resumen</TabsTrigger>
                <TabsTrigger value="detalle">Ventas Individuales</TabsTrigger>
                <TabsTrigger value="horario">Por Hora</TabsTrigger>
              </TabsList>

              <TabsContent value="resumen" className="space-y-4">
                <Card><CardHeader><CardTitle className="text-base">Actividad del día (€)</CardTitle></CardHeader><CardContent>
                  <div className="h-56 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyMetrics.ventasPorHora}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="hora" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} /><YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} /><Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number, name: string) => [name === 'euros' ? `${v.toFixed(2)}€` : v, name === 'euros' ? 'Ingresos' : 'Ventas']} /><Bar dataKey="euros" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="euros" /></BarChart></ResponsiveContainer></div>
                </CardContent></Card>

                {selectedMachine === 'all' && dailyMetrics.ventasPorMaquina.length > 0 && (
                  <Card><CardHeader><CardTitle className="text-base">Ranking por Máquina</CardTitle></CardHeader><CardContent className="space-y-3">
                    {dailyMetrics.ventasPorMaquina.map((m, i) => (
                      <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-3"><Badge variant={i === 0 ? 'default' : 'secondary'} className="w-7 h-7 rounded-full flex items-center justify-center p-0 text-xs">{i + 1}</Badge><span className="font-medium text-sm">{m.nombre}</span></div>
                        <div className="text-right"><p className="font-bold text-primary">{m.euros.toFixed(2)}€</p><p className="text-xs text-muted-foreground">{m.ventas} ventas</p></div>
                      </div>
                    ))}
                  </CardContent></Card>
                )}

                <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Métodos de Pago</CardTitle></CardHeader><CardContent>
                  <div className="flex flex-wrap gap-3">{Object.entries(dailyMetrics.byPayment).map(([method, count]) => (<Badge key={method} variant="secondary" className="text-sm py-1 px-3">{method.charAt(0).toUpperCase() + method.slice(1)}: {count}</Badge>))}</div>
                </CardContent></Card>
              </TabsContent>

              <TabsContent value="detalle">
                <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><List className="h-4 w-4" /> Todas las ventas<Badge variant="secondary" className="ml-auto">{ventasDia?.length || 0}</Badge></CardTitle></CardHeader><CardContent className="p-0">
                  <div className="overflow-x-auto"><Table><TableHeader><TableRow>
                    <TableHead className="w-[70px]">Hora</TableHead>
                    {selectedMachine === 'all' && <TableHead>Máquina</TableHead>}
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Toppings</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow></TableHeader><TableBody>
                    {ventasDia?.map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">{v.horaSpain}</TableCell>
                        {selectedMachine === 'all' && <TableCell className="text-xs">{getMachineName(v.maquina_id)}</TableCell>}
                        <TableCell className="font-medium text-sm max-w-[150px] truncate">{parseProductAndToppings(v.producto).productName}</TableCell>
                        <TableCell className="text-right font-bold text-primary">{Number(v.precio).toFixed(2)}€</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{normalizePaymentMethod(v.metodo_pago).charAt(0).toUpperCase() + normalizePaymentMethod(v.metodo_pago).slice(1)}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{formatToppings(v.toppings, v.producto)}</TableCell>
                        <TableCell><Badge variant={v.estado === 'exitoso' ? 'default' : 'destructive'} className="text-xs">{v.estado}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody></Table></div>
                </CardContent></Card>
              </TabsContent>

              <TabsContent value="horario">
                <Card><CardHeader><CardTitle className="text-base">Desglose por Hora</CardTitle></CardHeader><CardContent>
                  <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyMetrics.ventasPorHora}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="hora" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} /><YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} /><Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number, name: string) => [name === 'euros' ? `${v.toFixed(2)}€` : v, name === 'euros' ? 'Ingresos' : 'Ventas']} /><Bar dataKey="ventas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="ventas" /><Bar dataKey="euros" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="euros" /></BarChart></ResponsiveContainer></div>
                  <div className="space-y-2 mt-4">{dailyMetrics.ventasPorHora.map(h => (<div key={h.hora} className="flex items-center justify-between py-2 border-b last:border-0"><div className="flex items-center gap-3"><Clock className="h-4 w-4 text-muted-foreground" /><span className="font-mono font-medium">{h.hora}</span></div><div className="flex items-center gap-4"><span className="text-sm text-muted-foreground">{h.ventas} ventas</span><span className="font-bold text-primary">{h.euros.toFixed(2)}€</span></div></div>))}</div>
                </CardContent></Card>
              </TabsContent>
            </Tabs>
          </>
        )
      ) : (
        /* =================== MONTHLY VIEW =================== */
        !monthlyMetrics ? (
          <Card><CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium text-muted-foreground">Sin datos para este período</p>
            <Button onClick={handleRefresh} disabled={syncing} className="mt-4"><RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />Sincronizar ventas</Button>
          </CardContent></Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Euro className="h-4 w-4" /> Facturación</div><p className="text-2xl font-bold text-primary">{monthlyMetrics.totalEuros.toFixed(2)}€</p><p className="text-xs text-muted-foreground">{monthlyMetrics.totalVentas} ventas</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><TrendingUp className="h-4 w-4" /> Ticket Medio</div><p className="text-2xl font-bold">{monthlyMetrics.avgTicket.toFixed(2)}€</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><IceCream className="h-4 w-4" /> Tarrinas</div><p className="text-2xl font-bold">{monthlyMetrics.totalUnidades}</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground mb-1"><Clock className="h-4 w-4" /> Hora Punta</div><p className="text-2xl font-bold">{monthlyMetrics.mejorHora?.hora || '--'}</p><p className="text-xs text-muted-foreground">{monthlyMetrics.mejorHora?.ventas || 0} ventas</p></CardContent></Card>
            </div>

            {(monthlyMetrics.mejorDia || monthlyMetrics.peorDia) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {monthlyMetrics.mejorDia && <Card className="border-success/30 bg-success/5"><CardContent className="p-4 flex items-center gap-3"><ArrowUpRight className="h-5 w-5 text-success" /><div><p className="text-sm font-medium">Mejor día</p><p className="text-lg font-bold">{monthlyMetrics.mejorDia.label} — {monthlyMetrics.mejorDia.euros.toFixed(2)}€</p></div></CardContent></Card>}
                {monthlyMetrics.peorDia && <Card className="border-warning/30 bg-warning/5"><CardContent className="p-4 flex items-center gap-3"><ArrowDownRight className="h-5 w-5 text-warning" /><div><p className="text-sm font-medium">Día más flojo</p><p className="text-lg font-bold">{monthlyMetrics.peorDia.label} — {monthlyMetrics.peorDia.euros.toFixed(2)}€</p></div></CardContent></Card>}
              </div>
            )}

            <Tabs defaultValue="daily-chart" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="daily-chart">Diario</TabsTrigger>
                <TabsTrigger value="toppings">Toppings</TabsTrigger>
                <TabsTrigger value="payments">Pagos</TabsTrigger>
                <TabsTrigger value="calendar">Calendario</TabsTrigger>
              </TabsList>

              <TabsContent value="daily-chart" className="space-y-4">
                <Card><CardHeader><CardTitle className="text-base">Ventas diarias (€)</CardTitle></CardHeader><CardContent>
                  <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyMetrics.ventasPorDia}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} /><YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} /><Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [`${v.toFixed(2)}€`, 'Ingresos']} /><Bar dataKey="euros" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
                </CardContent></Card>
                <Card><CardHeader><CardTitle className="text-base">Desglose por Producto</CardTitle></CardHeader><CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">{monthlyMetrics.ventasPorProducto.map((p, i) => (<div key={i} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0"><span className="text-sm truncate max-w-[60%]">{p.producto}</span><div className="text-right"><span className="font-semibold text-sm">{p.euros.toFixed(2)}€</span><span className="text-xs text-muted-foreground ml-2">({p.ventas})</span></div></div>))}</div>
                </CardContent></Card>
              </TabsContent>

              <TabsContent value="toppings" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Popularidad de Toppings</CardTitle></CardHeader><CardContent>
                    <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={monthlyMetrics.ventasPorTopping.slice(0, 8)} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="cantidad" nameKey="nombre" label={({ nombre, cantidad }) => `${nombre}: ${cantidad}`}>{monthlyMetrics.ventasPorTopping.slice(0, 8).map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
                  </CardContent></Card>
                  <Card><CardHeader><CardTitle className="text-base">Ranking de Toppings</CardTitle></CardHeader><CardContent>
                    <div className="space-y-2">{monthlyMetrics.ventasPorTopping.map((t, i) => { const max = monthlyMetrics.ventasPorTopping[0]?.cantidad || 1; return (<div key={i} className="space-y-1"><div className="flex justify-between text-sm"><span>{t.nombre}</span><span className="font-semibold">{t.cantidad} usos</span></div><div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${(t.cantidad / max) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} /></div></div>); })}</div>
                  </CardContent></Card>
                </div>
              </TabsContent>

              <TabsContent value="payments" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Métodos de Pago</CardTitle></CardHeader><CardContent>
                    <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={monthlyMetrics.ventasPorMetodoPago} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="ventas" nameKey="metodo" label={({ metodo, ventas }) => `${metodo}: ${ventas}`}>{monthlyMetrics.ventasPorMetodoPago.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
                  </CardContent></Card>
                  <Card><CardHeader><CardTitle className="text-base">Detalle por Método</CardTitle></CardHeader><CardContent>
                    <div className="space-y-4">{monthlyMetrics.ventasPorMetodoPago.map((m, i) => (<div key={i} className="p-3 rounded-lg bg-muted/50"><div className="flex items-center justify-between mb-1"><span className="font-medium">{m.metodo}</span><Badge variant="secondary">{((m.ventas / monthlyMetrics.totalVentas) * 100).toFixed(1)}%</Badge></div><div className="flex justify-between text-sm text-muted-foreground"><span>{m.ventas} transacciones</span><span className="font-semibold text-foreground">{m.euros.toFixed(2)}€</span></div></div>))}</div>
                  </CardContent></Card>
                </div>
              </TabsContent>

              <TabsContent value="calendar">
                <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Calendario de Ventas</CardTitle></CardHeader><CardContent>
                  <div className="grid grid-cols-7 gap-1">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (<div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>))}
                    {(() => { const firstDay = startOfMonth(currentMonth).getDay(); const offset = firstDay === 0 ? 6 : firstDay - 1; return Array.from({ length: offset }).map((_, i) => (<div key={`empty-${i}`} className="p-2" />)); })()}
                    {monthlyMetrics.calendarioDias.map(day => {
                      const maxEuros = Math.max(...monthlyMetrics.calendarioDias.map(d => d.euros), 1);
                      const intensity = day.euros > 0 ? Math.max(0.15, day.euros / maxEuros) : 0;
                      const isToday = day.fecha === todayStr;
                      return (
                        <div key={day.fecha} className={cn("p-2 rounded-lg text-center transition-colors min-h-[60px] flex flex-col justify-center", isToday && "ring-2 ring-primary", day.ventas === 0 && "bg-muted/30")} style={day.euros > 0 ? { backgroundColor: `hsl(var(--primary) / ${intensity})` } : undefined}>
                          <span className={cn("text-xs font-medium", day.euros > 0 && intensity > 0.5 && "text-primary-foreground")}>{day.dia}</span>
                          {day.ventas > 0 && (<><span className={cn("text-xs font-bold", intensity > 0.5 ? "text-primary-foreground" : "text-foreground")}>{day.euros.toFixed(0)}€</span><span className={cn("text-[10px]", intensity > 0.5 ? "text-primary-foreground/80" : "text-muted-foreground")}>{day.ventas}v</span></>)}
                        </div>
                      );
                    })}
                  </div>
                </CardContent></Card>
              </TabsContent>
            </Tabs>
          </>
        )
      )}
    </div>
  );
};
