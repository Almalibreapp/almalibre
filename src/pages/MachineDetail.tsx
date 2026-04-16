import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TemperatureChart } from '@/components/dashboard/TemperatureChart';
import { StockReplenishment } from '@/components/stock/StockReplenishment';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { useStockSync } from '@/hooks/useStockSync';
import { useStockPolling } from '@/hooks/useStockPolling';
import { useAuth } from '@/hooks/useAuth';
import { useMaquinas } from '@/hooks/useMaquinas';
import { useMaquinaData, useVentasDetalle } from '@/hooks/useMaquinaData';
import { useVentasRealtime } from '@/hooks/useVentasRealtime';
import { useLocalNotifications } from '@/hooks/useLocalNotifications';
import { useTemperatureLog, useLogTemperature } from '@/hooks/useTemperatureLog';
import { fetchOrdenes, fetchEstadoMaquina } from '@/services/api';
import { ControlTab } from '@/components/control/ControlTab';
import { cn } from '@/lib/utils';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { fetchSpanishDayOrders, isSuccessfulSale, summarizeSales, getCurrentSpainDate, shiftSpainDate, getMonthDatesUntil } from '@/lib/sales';
import {
  ArrowLeft,
  Settings,
  Thermometer,
  Euro,
  Package,
  RefreshCw,
  Loader2,
  MapPin,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Flame,
  Calendar,
  CalendarIcon,
  Clock,
  Download,
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Snowflake,
} from 'lucide-react';
const decodeHtml = (text: string): string => {
  if (!text || typeof window === 'undefined') return text || '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

export const MachineDetail = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { maquinas } = useMaquinas(user?.id);

  const maquina = maquinas.find((m) => m.id === id);
  // mac_address field stores the IMEI
  const imei = maquina?.mac_address;
  
  const { temperatura, ventas, stock, isLoading, hasError, error, refetchAll, isRefetching } = useMaquinaData(imei);
  const { data: ventasDetalle, dataUpdatedAt: ventasDetalleUpdatedAt } = useVentasDetalle(imei);
  
  // Auto-sync stock from sales
  useStockSync(imei);
  useVentasRealtime(imei);
  const { ultimaActualizacion: stockLastUpdate, polling: stockPolling, refrescarAhora: refrescarStock } = useStockPolling(imei, 1);
  useLocalNotifications(
    ventasDetalle?.ventas,
    temperatura?.temperatura,
    undefined, // estado not directly available from ToppingsResponse
    imei
  );

  // Last updated tracking
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [timeSinceUpdate, setTimeSinceUpdate] = useState('ahora');

  // Update lastUpdated when ventasDetalle changes
  useEffect(() => {
    if (ventasDetalleUpdatedAt) {
      setLastUpdated(new Date(ventasDetalleUpdatedAt));
    }
  }, [ventasDetalleUpdatedAt]);

  // Update relative time string every 30s
  useEffect(() => {
    const updateTime = () => {
      const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      if (diff < 60) setTimeSinceUpdate('ahora');
      else if (diff < 120) setTimeSinceUpdate('hace 1 min');
      else setTimeSinceUpdate(`hace ${Math.floor(diff / 60)} min`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Auto-refresh every 2 minutes when tab is active
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refetchAll();
      }
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refetchAll]);
  
  // Spain timezone constants (declared early for use in queries)
  const todaySpain = getCurrentSpainDate();
  const currentMonthSpain = todaySpain.substring(0, 7);

  // State for date navigation  
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // null = today
  const [showAllSales, setShowAllSales] = useState(false);
  const [tempLogHours, setTempLogHours] = useState(24);
  
  // Calculate date string
  const getSelectedDateStr = () => {
    if (!selectedDate) return undefined; // today
    return selectedDate;
  };
  
  const navigateDate = (direction: 'prev' | 'next') => {
    const current = selectedDate ? new Date(selectedDate) : new Date();
    if (direction === 'prev') {
      current.setDate(current.getDate() - 1);
    } else {
      current.setDate(current.getDate() + 1);
    }
    const today = new Date();
    today.setHours(0,0,0,0);
    current.setHours(0,0,0,0);
    if (current >= today) {
      setSelectedDate(null); // back to today
    } else {
      setSelectedDate(current.toISOString().split('T')[0]);
    }
  };
  
  const isToday = selectedDate === null;
  const displayDate = selectedDate 
    ? format(new Date(selectedDate), "EEEE d 'de' MMMM", { locale: es })
    : 'Hoy';
  
  // Query for selected date's sales using centralized fetchSpanishDayOrders
  const { data: ventasSelectedDateRaw, isLoading: loadingSelected } = useQuery({
    queryKey: ['ventas-detalle-date', imei, selectedDate],
    queryFn: async () => {
      if (!imei || isToday) return null;
      return fetchSpanishDayOrders(imei, selectedDate!, fetchOrdenes);
    },
    enabled: !!imei && !isToday,
  });

  // Prefetch adjacent days for faster navigation
  useEffect(() => {
    if (!imei) return;
    const currentDateStr = selectedDate || todaySpain;
    
    // Prefetch previous day
    const prevStr = shiftSpainDate(currentDateStr, -1);
    queryClient.prefetchQuery({
      queryKey: ['ventas-detalle-date', imei, prevStr],
      queryFn: () => fetchSpanishDayOrders(imei, prevStr, fetchOrdenes),
      staleTime: 5 * 60 * 1000,
    });

    // Prefetch next day (if not future)
    const nextStr = shiftSpainDate(currentDateStr, 1);
    if (nextStr <= todaySpain) {
      queryClient.prefetchQuery({
        queryKey: ['ventas-detalle-date', imei, nextStr],
        queryFn: () => fetchSpanishDayOrders(imei, nextStr, fetchOrdenes),
        staleTime: 5 * 60 * 1000,
      });
    }
  }, [imei, selectedDate, todaySpain, queryClient]);

  // Helper to get the displayed hora (machine-aware) for sorting
  const getDisplayHora = (v: any): string => {
    if (v?.fecha_hora_china && imei) return convertirHoraSegunMaquina(v.fecha_hora_china, imei);
    return String(v?.hora || '00:00').substring(0, 5);
  };

  // Today's sales already come pre-normalized from useVentasDetalle
  const ventasHoyFiltered = useMemo(() => {
    if (!ventasDetalle?.ventas) return [];
    return [...ventasDetalle.ventas].sort((a: any, b: any) =>
      getDisplayHora(b).localeCompare(getDisplayHora(a))
    );
  }, [ventasDetalle, imei]);

  const ventasSelectedSorted = useMemo(() => {
    if (!ventasSelectedDateRaw) return [];
    return [...ventasSelectedDateRaw].sort((a: any, b: any) =>
      getDisplayHora(b).localeCompare(getDisplayHora(a))
    );
  }, [ventasSelectedDateRaw, imei]);

  const currentVentas = isToday 
    ? { ventas: ventasHoyFiltered, total_ventas: ventasHoyFiltered.length }
    : { ventas: ventasSelectedSorted, total_ventas: ventasSelectedSorted.length };
  const currentLoading = isToday ? false : loadingSelected;

  // --- Spain-timezone-aware sales calculations ---

  // TODAY: Use API data directly (same source as detail view) for real-time accuracy
  const ventasHoySpain = useMemo(() => {
    // ventasHoyFiltered comes from the API, already filtered by Spain date
    // Accept sales unless explicitly marked as failed/cancelled
    const exitosas = ventasHoyFiltered.filter((v: any) => {
      const estado = (v.estado || '').toLowerCase();
      return estado !== 'fallido' && estado !== 'cancelado' && estado !== 'failed' && estado !== 'cancelled';
    });
    const euros = exitosas.reduce((s: number, v: any) => s + Number(v.precio), 0);
    const cantidad = exitosas.length;
    console.log(`[Dashboard] Hoy desde API: ${cantidad} ventas, ${euros.toFixed(2)}€ (total sin filtrar: ${ventasHoyFiltered.length})`);
    return { euros, cantidad };
  }, [ventasHoyFiltered]);

  // Yesterday in Spain
  const yesterdaySpain = useMemo(() => shiftSpainDate(todaySpain, -1), [todaySpain]);

  // Fetch yesterday's sales using centralized normalization
  const { data: ventasAyerApi } = useQuery({
    queryKey: ['ventas-ayer-api', imei, yesterdaySpain],
    queryFn: () => {
      if (!imei) return [];
      return fetchSpanishDayOrders(imei, yesterdaySpain, fetchOrdenes);
    },
    enabled: !!imei,
    staleTime: 5 * 60 * 1000,
  });

  const ventasAyerSpain = useMemo(() => {
    const exitosas = (ventasAyerApi || []).filter(isSuccessfulSale);
    return {
      euros: exitosas.reduce((s: number, v: any) => s + Number(v.precio), 0),
      cantidad: exitosas.length,
    };
  }, [ventasAyerApi]);

  // Monthly sales: fetch each day using centralized normalization
  const monthDays = useMemo(() => getMonthDatesUntil(todaySpain), [todaySpain]);

  const { data: ventasMesApi } = useQuery({
    queryKey: ['ventas-mes-api', imei, currentMonthSpain],
    queryFn: async () => {
      if (!imei) return [];
      const allSales = await Promise.all(
        monthDays.map(fecha =>
          fetchSpanishDayOrders(imei, fecha, fetchOrdenes).catch(() => [])
        )
      );
      // Deduplicate by saleUid
      const seen = new Set<string>();
      return allSales.flat().filter((v: any) => {
        const key = v.saleUid || v.id || `${v.fecha}-${v.hora}-${v.precio}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    enabled: !!imei,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const ventasMesFinal = useMemo(() => {
    const exitosas = (ventasMesApi || []).filter(isSuccessfulSale);
    return {
      cantidad: exitosas.length,
      total_euros: exitosas.reduce((s: number, v: any) => s + Number(v.precio), 0),
    };
  }, [ventasMesApi]);

  // Machine estado - periodic polling every 3 minutes
  const { data: estadoMaquina, isLoading: loadingEstado } = useQuery({
    queryKey: ['machine-estado', imei],
    queryFn: () => fetchEstadoMaquina(imei!),
    enabled: !!imei,
    refetchInterval: 3 * 60 * 1000,
    retry: 1,
  });

  // Derive real estado from componentes
  const deriveEstadoFromComponents = () => {
    if (!estadoMaquina?.componentes) return 'unknown';
    const comps = estadoMaquina.componentes;
    const ventaOk = comps.venta === 'activa' || comps.venta === 'ok';
    const refrigOk = comps.refrigeracion === 'ok' || comps.refrigeracion === 'normal' || comps.refrigeracion === 'activa';
    const componentesArr = Object.entries(comps).map(([nombre, valor]: [string, any]) => {
      let estado: string;
      if (typeof valor === 'boolean') {
        if (nombre === 'agotado' && valor === true && ventaOk) estado = 'ok';
        else estado = valor ? 'alerta' : 'ok';
      } else {
        estado = String(valor);
      }
      return { nombre, estado };
    });
    const hasRealError = componentesArr.some(c => {
      const e = c.estado.toLowerCase();
      return e === 'error' || e === 'cerrada' || e === 'fallo';
    });
    if (hasRealError) return 'error';
    if (ventaOk && refrigOk) return 'ok';
    if (comps.agotado === true) return 'alerta';
    return 'ok';
  };
  const estadoReal = deriveEstadoFromComponents();

  // Temperature traceability
  const { data: tempLog } = useTemperatureLog(maquina?.id, tempLogHours, imei);
  const logTemperature = useLogTemperature();

  // Auto-log temperature every time we get a new reading
  useEffect(() => {
    if (temperatura && maquina?.id) {
      logTemperature.mutate({
        maquinaId: maquina.id,
        temperatura: temperatura.temperatura,
        unidad: temperatura.unidad || 'C',
        estado: temperatura.estado,
      });
    }
  }, [temperatura?.temperatura, temperatura?.timestamp]);

  // Peak hour calculation
  const calculatePeakHour = () => {
    const ventas = currentVentas?.ventas ?? [];
    if (ventas.length === 0) return null;
    const porHora: Record<string, { ventas: number; ingresos: number }> = {};
    ventas.forEach(v => {
      const hora = (v._spainHora || v.hora).split(':')[0] + ':00';
      if (!porHora[hora]) porHora[hora] = { ventas: 0, ingresos: 0 };
      porHora[hora].ventas += 1;
      porHora[hora].ingresos += v.precio;
    });
    let peak: { hora: string; ventas: number; ingresos: number } | null = null;
    let max = 0;
    Object.entries(porHora).forEach(([hora, d]) => {
      if (d.ventas > max) { max = d.ventas; peak = { hora, ...d }; }
    });
    return peak;
  };
  
  const peakHour = calculatePeakHour();

  if (!maquina) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Máquina no encontrada</p>
          <Button variant="link" onClick={() => navigate('/')}>
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }

  if (!imei) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-warning mx-auto mb-4" />
          <p className="text-muted-foreground">Esta máquina no tiene IMEI configurado</p>
          <Button variant="link" onClick={() => navigate('/')}>
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }

  const getTempStatusBadge = () => {
    if (temperatura?.temperatura === undefined) return null;
    if (temperatura.temperatura >= 11) {
      return <Badge className="bg-critical-light text-critical border-critical/30">Crítico</Badge>;
    }
    return <Badge className="bg-success-light text-success border-success/30">Normal</Badge>;
  };

  // Stock crítico al 25%
  const lowStockToppings = stock?.toppings?.filter(
    (t) => t.capacidad_maxima > 0 && t.stock_actual / t.capacidad_maxima <= 0.25
  ) || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="mr-3"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold">{maquina.nombre_personalizado}</h1>
              {maquina.ubicacion && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{maquina.ubicacion}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">{timeSinceUpdate}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { refetchAll(); setLastUpdated(new Date()); }}
              disabled={isRefetching}
            >
              <RefreshCw className={cn("h-5 w-5", isRefetching && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/machine/${id}/settings`)}
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : hasError ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertCircle className="h-12 w-12 text-warning mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sin datos disponibles</h3>
            <p className="text-muted-foreground text-sm mb-4 max-w-sm">
              {error?.message || 'No se pudieron obtener los datos de esta máquina. Verifica que el IMEI sea correcto.'}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              IMEI: {imei}
            </p>
            <Button onClick={refetchAll} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">General</TabsTrigger>
              <TabsTrigger value="sales">Ventas</TabsTrigger>
              <TabsTrigger value="stock">Stock</TabsTrigger>
              <TabsTrigger value="temp">Temp</TabsTrigger>
              <TabsTrigger value="control">Control</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 animate-fade-in">
              {/* Temperature Card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Thermometer className="h-4 w-4 text-primary" />
                      Temperatura
                    </CardTitle>
                    {getTempStatusBadge()}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-primary mb-2">
                    {temperatura?.temperatura !== undefined ? `${temperatura.temperatura}°${temperatura.unidad || 'C'}` : '--°C'}
                  </div>
                  {temperatura?.timestamp && (
                    <p className="text-xs text-muted-foreground">
                      Última lectura: {temperatura.timestamp}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Sales Summary Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Euro className="h-4 w-4 text-primary" />
                    Resumen de Ventas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-muted/30 rounded-lg min-w-0">
                      <p className="text-[10px] text-muted-foreground mb-0.5 truncate">Hoy</p>
                      <p className="text-base sm:text-xl font-bold text-primary truncate">
                        {ventasHoySpain.euros.toFixed(0)}€
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {ventasHoySpain.cantidad} vtas
                      </p>
                    </div>
                    <div className="text-center p-2 bg-muted/30 rounded-lg min-w-0">
                      <p className="text-[10px] text-muted-foreground mb-0.5 truncate">Ayer</p>
                      <p className="text-base sm:text-xl font-bold truncate">
                        {ventasAyerSpain.euros.toFixed(0)}€
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {ventasAyerSpain.cantidad} vtas
                      </p>
                    </div>
                    <div className="text-center p-2 bg-muted/30 rounded-lg min-w-0">
                      <p className="text-[10px] text-muted-foreground mb-0.5 truncate">Mes</p>
                      <p className="text-base sm:text-xl font-bold truncate">
                        {ventasMesFinal.total_euros.toFixed(0)}€
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {ventasMesFinal.cantidad} vtas
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Machine Status Card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      Estado de la Máquina
                    </CardTitle>
                    {loadingEstado ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : estadoReal === 'ok' ? (
                      <Badge className="bg-success text-success-foreground">🟢 OK</Badge>
                    ) : estadoReal === 'alerta' ? (
                      <Badge className="bg-warning text-warning-foreground">🟡 Alerta</Badge>
                    ) : estadoReal === 'error' ? (
                      <Badge variant="destructive">🔴 Error</Badge>
                    ) : (
                      <Badge variant="secondary">Desconocido</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {estadoMaquina?.componentes ? (
                    <div className="space-y-2">
                      {Object.entries(estadoMaquina.componentes).map(([nombre, valor]: [string, any]) => {
                        const displayName = nombre.charAt(0).toUpperCase() + nombre.slice(1);
                        let estadoStr: string;
                        if (typeof valor === 'boolean') {
                          const comps = estadoMaquina.componentes;
                          if (nombre === 'agotado' && valor === true && (comps.venta === 'activa' || comps.venta === 'ok')) {
                            estadoStr = 'ok';
                          } else {
                            estadoStr = valor ? 'alerta' : 'ok';
                          }
                        } else {
                          estadoStr = String(valor);
                        }
                        const e = estadoStr.toLowerCase();
                        const isOk = e === 'ok' || e === 'activa' || e === 'normal' || e === 'false' || e === '0' || e === 'inactiva';
                        const isError = e === 'error' || e === 'cerrada' || e === 'fallo';
                        return (
                          <div key={nombre} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2">
                              {nombre.toLowerCase().includes('refriger') ? <Snowflake className="h-3.5 w-3.5" /> :
                               nombre.toLowerCase().includes('venta') ? <Euro className="h-3.5 w-3.5" /> :
                               <Package className="h-3.5 w-3.5" />}
                              <span className="text-sm font-medium">{displayName}</span>
                            </div>
                            <Badge variant="outline" className={cn(
                              "text-xs",
                              isOk && "border-success text-success",
                              isError && "border-critical text-critical",
                              !isOk && !isError && "border-warning text-warning",
                            )}>
                              {isOk ? <CheckCircle className="h-3 w-3 mr-1" /> : isError ? <XCircle className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                              {estadoStr}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  ) : !loadingEstado ? (
                    <p className="text-sm text-muted-foreground">No se pudo obtener el estado</p>
                  ) : null}
                </CardContent>
              </Card>

              {/* Stock Alert Card */}
              {lowStockToppings.length > 0 && (
                <Card className="border-warning/50 bg-warning-light">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-warning">
                      <Package className="h-4 w-4" />
                      Stock Bajo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {lowStockToppings.map((topping) => (
                        <div
                          key={topping.posicion}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="font-medium">{topping.nombre}</span>
                          <span className="text-warning font-semibold">
                            {topping.stock_actual}/{topping.capacidad_maxima}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Sales Tab */}
            <TabsContent value="sales" className="space-y-4 animate-fade-in">
              {/* Date Navigation with Calendar */}
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" size="icon" onClick={() => navigateDate('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 max-w-xs">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      <span className="capitalize">{displayDate}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate ? new Date(selectedDate + 'T12:00:00') : new Date()}
                      onSelect={(date) => {
                        if (!date) return;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const sel = new Date(date);
                        sel.setHours(0, 0, 0, 0);
                        if (sel >= today) {
                          setSelectedDate(null);
                        } else {
                          setSelectedDate(format(sel, 'yyyy-MM-dd'));
                        }
                      }}
                      disabled={(date) => date > new Date()}
                      locale={es}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <Button variant="outline" size="icon" onClick={() => navigateDate('next')} disabled={isToday}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Quick access buttons */}
              <div className="flex items-center justify-center gap-2">
                <Button variant={isToday ? "default" : "outline"} size="sm" onClick={() => setSelectedDate(null)}>
                  Hoy
                </Button>
                <Button 
                  variant={selectedDate === subDays(new Date(), 1).toISOString().split('T')[0] ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setSelectedDate(subDays(new Date(), 1).toISOString().split('T')[0])}
                >
                  Ayer
                </Button>
                <Button 
                  variant={selectedDate === subDays(new Date(), 7).toISOString().split('T')[0] ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setSelectedDate(subDays(new Date(), 7).toISOString().split('T')[0])}
                >
                  Hace 7 días
                </Button>
              </div>

              {/* Monthly summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Resumen Mensual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold text-primary">{ventasMesFinal.total_euros.toFixed(2)}€</p>
                      <p className="text-xs text-muted-foreground">Ingresos del mes</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">{ventasMesFinal.cantidad}</p>
                      <p className="text-xs text-muted-foreground">Ventas del mes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Peak hour */}
              {peakHour && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Flame className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Hora Caliente</p>
                      <p className="text-xl font-bold text-primary">{peakHour.hora}h</p>
                      <p className="text-xs text-muted-foreground">{peakHour.ventas} ventas · {peakHour.ingresos.toFixed(2)}€</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {currentLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        Ventas por Hora
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <SalesChart 
                        ventas={(currentVentas?.ventas || []) as any[]}
                        imei={imei}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Listado de Ventas</CardTitle>
                        {currentVentas?.total_ventas !== undefined && (
                          <Badge variant="secondary">
                            {currentVentas.total_ventas} ventas
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {(currentVentas?.ventas || []).length > 0 ? (
                        <>
                          <div className="space-y-3">
                            {(currentVentas?.ventas || [])
                              .slice(0, showAllSales ? undefined : 10)
                              .map((venta) => (
                              <div
                                key={venta.id}
                                className="flex items-center justify-between py-2 border-b last:border-0"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium capitalize">{decodeHtml(venta.producto)}</p>
                                    <span className="text-xs text-muted-foreground">{venta._spainHora || venta.hora}</span>
                                  </div>
                                  {venta.toppings && venta.toppings.length > 0 && (
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                      {venta.toppings.map((t, idx) => (
                                        <Badge key={`${t.posicion}-${idx}`} variant="secondary" className="text-xs">
                                          {decodeHtml(t.nombre)}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right space-y-1">
                                  <span className="font-semibold text-primary">{venta.precio.toFixed(2)} €</span>
                                  <div className="flex items-center gap-1 justify-end">
                                    <Badge 
                                      variant="outline" 
                                      className={cn(
                                        "text-xs",
                                        venta.metodo_pago === 'tarjeta' && "border-blue-500/30 text-blue-600",
                                        venta.metodo_pago === 'efectivo' && "border-green-500/30 text-green-600",
                                        venta.metodo_pago === 'cupón' && "border-purple-500/30 text-purple-600",
                                        !['tarjeta', 'efectivo', 'cupón'].includes(venta.metodo_pago) && "border-muted-foreground/30"
                                      )}
                                    >
                                      {venta.metodo_pago === 'tarjeta' ? '💳' : venta.metodo_pago === 'efectivo' ? '💵' : venta.metodo_pago === 'cupón' ? '🎟️' : '💳'} {venta.metodo_pago || 'tarjeta'}
                                    </Badge>
                                    <Badge 
                                      variant="outline" 
                                      className={cn(
                                        "text-xs",
                                        venta.estado === 'exitoso' && "border-success/30 text-success",
                                        venta.estado === 'fallido' && "border-critical/30 text-critical"
                                      )}
                                    >
                                      {venta.estado}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {(currentVentas?.ventas || []).length > 10 && (
                            <Button 
                              variant="ghost" 
                              className="w-full mt-4" 
                              onClick={() => setShowAllSales(!showAllSales)}
                            >
                              {showAllSales ? 'Mostrar menos' : `Ver todas (${currentVentas?.ventas?.length})`}
                            </Button>
                          )}
                        </>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">
                          No hay ventas registradas {displayDate.toLowerCase()}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* Stock Tab */}
            <TabsContent value="stock" className="space-y-4 animate-fade-in">
              <StockReplenishment imei={imei!} stock={stock} />
            </TabsContent>

            {/* Temperature Tab */}
            <TabsContent value="temp" className="space-y-4 animate-fade-in">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Temperatura Actual</CardTitle>
                    {getTempStatusBadge()}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-5xl font-bold text-primary text-center py-6">
                    {temperatura?.temperatura !== undefined ? `${temperatura.temperatura}°${temperatura.unidad || 'C'}` : '--°C'}
                  </div>
                  {temperatura?.timestamp && (
                    <p className="text-center text-xs text-muted-foreground">
                      Última lectura: {temperatura.timestamp}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Temperature Traceability Chart */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Thermometer className="h-4 w-4 text-primary" />
                      Trazabilidad de Temperatura
                    </CardTitle>
                    <div className="flex gap-1">
                      {[6, 12, 24, 48].map(h => (
                        <Button 
                          key={h} 
                          variant={tempLogHours === h ? "default" : "outline"} 
                          size="sm" 
                          className="text-xs px-2 h-7"
                          onClick={() => setTempLogHours(h)}
                        >
                          {h}h
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {tempLog && tempLog.length > 0 ? (
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={tempLog.map(r => {
                          const dt = new Date(r.created_at);
                          // Temperature readings already stored in local time
                          return {
                            hora: format(dt, 'HH:mm'),
                            temperatura: Number(r.temperatura),
                            estado: r.estado,
                          };
                        })} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <XAxis 
                            dataKey="hora" 
                            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} 
                            tickLine={false} axisLine={false}
                            interval="preserveStartEnd"
                          />
                          <YAxis 
                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                            tickLine={false} axisLine={false}
                            domain={['dataMin - 2', 'dataMax + 2']}
                          />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                            formatter={(value: number) => [`${value.toFixed(1)}°C`, 'Temperatura']}
                          />
                          <ReferenceLine y={11} stroke="hsl(var(--critical))" strokeDasharray="5 5" label={{ value: 'Crítico 11°C', fill: 'hsl(var(--critical))', fontSize: 10 }} />
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
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Thermometer className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Sin registros de temperatura aún</p>
                      <p className="text-xs mt-1">Los registros se generan automáticamente al consultar la temperatura</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Temperature stats */}
              {tempLog && tempLog.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Estadísticas ({tempLogHours}h)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-lg font-bold text-success">
                          {Math.min(...tempLog.map(r => Number(r.temperatura))).toFixed(1)}°C
                        </p>
                        <p className="text-xs text-muted-foreground">Mínima</p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-lg font-bold">
                          {(tempLog.reduce((a, r) => a + Number(r.temperatura), 0) / tempLog.length).toFixed(1)}°C
                        </p>
                        <p className="text-xs text-muted-foreground">Media</p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className={cn(
                          "text-lg font-bold",
                          Math.max(...tempLog.map(r => Number(r.temperatura))) >= 11 ? 'text-critical' : 'text-success'
                        )}>
                          {Math.max(...tempLog.map(r => Number(r.temperatura))).toFixed(1)}°C
                        </p>
                        <p className="text-xs text-muted-foreground">Máxima</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-3">
                      {tempLog.length} lecturas registradas
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Control Tab */}
            <TabsContent value="control" className="space-y-4 animate-fade-in">
              <ControlTab imei={imei!} ubicacion={maquina.ubicacion || ''} readOnly />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};
