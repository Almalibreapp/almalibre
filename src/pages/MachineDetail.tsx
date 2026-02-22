import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { TemperatureChart } from '@/components/dashboard/TemperatureChart';
import { StockReplenishment } from '@/components/stock/StockReplenishment';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { useStockSync } from '@/hooks/useStockSync';
import { useAuth } from '@/hooks/useAuth';
import { useMaquinas } from '@/hooks/useMaquinas';
import { useMaquinaData, useVentasDetalle } from '@/hooks/useMaquinaData';
import { useTemperatureLog, useLogTemperature } from '@/hooks/useTemperatureLog';
import { fetchVentasDetalle } from '@/services/api';
import { cn } from '@/lib/utils';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { convertChinaToSpain } from '@/lib/timezone';
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
  Clock,
  Download,
} from 'lucide-react';

export const MachineDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { maquinas } = useMaquinas(user?.id);

  const maquina = maquinas.find((m) => m.id === id);
  // mac_address field stores the IMEI
  const imei = maquina?.mac_address;
  
  const { temperatura, ventas, stock, isLoading, hasError, error, refetchAll, isRefetching } = useMaquinaData(imei);
  const { data: ventasDetalle } = useVentasDetalle(imei);
  
  // Auto-sync stock from sales
  useStockSync(imei);
  
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
  
  // Query for selected date's sales
  const { data: ventasSelectedDate, isLoading: loadingSelected } = useQuery({
    queryKey: ['ventas-detalle-date', imei, getSelectedDateStr()],
    queryFn: () => fetchVentasDetalle(imei!, getSelectedDateStr()),
    enabled: !!imei && !isToday,
  });
  
  const currentVentas = isToday ? ventasDetalle : ventasSelectedDate;
  const currentLoading = isToday ? false : loadingSelected;

  // Temperature traceability
  const { data: tempLog } = useTemperatureLog(maquina?.id, tempLogHours);
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
      const horaSpain = convertChinaToSpain(v.hora, currentVentas?.fecha);
      const hora = horaSpain.split(':')[0] + ':00';
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
            <Button
              variant="ghost"
              size="icon"
              onClick={refetchAll}
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">General</TabsTrigger>
              <TabsTrigger value="sales">Ventas</TabsTrigger>
              <TabsTrigger value="stock">Stock</TabsTrigger>
              <TabsTrigger value="temp">Temp</TabsTrigger>
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
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Hoy</p>
                      <p className="text-xl font-bold text-primary">
                        {ventas?.ventas_hoy?.total_euros?.toFixed(2) ?? '0.00'}€
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ventas?.ventas_hoy?.cantidad ?? 0} ventas
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Ayer</p>
                      <p className="text-xl font-bold">
                        {ventas?.ventas_ayer?.total_euros?.toFixed(2) ?? '0.00'}€
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ventas?.ventas_ayer?.cantidad ?? 0} ventas
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Este mes</p>
                      <p className="text-xl font-bold">
                        {ventas?.ventas_mes?.total_euros?.toFixed(2) ?? '0.00'}€
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ventas?.ventas_mes?.cantidad ?? 0} ventas
                      </p>
                    </div>
                  </div>
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
              {/* Date Navigation */}
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => navigateDate('prev')}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <div className="text-center">
                  <p className="font-medium capitalize text-sm">{displayDate}</p>
                  {selectedDate && (
                    <Button variant="link" size="sm" className="text-xs p-0 h-auto" onClick={() => setSelectedDate(null)}>
                      Volver a hoy
                    </Button>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => navigateDate('next')} disabled={isToday}>
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
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
                      <p className="text-2xl font-bold text-primary">{ventas?.ventas_mes?.total_euros?.toFixed(2) ?? '0.00'}€</p>
                      <p className="text-xs text-muted-foreground">Ingresos del mes</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold">{ventas?.ventas_mes?.cantidad ?? 0}</p>
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
                        ventas={currentVentas?.ventas || []} 
                        fecha={currentVentas?.fecha} 
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
                                    <p className="font-medium capitalize">{venta.producto}</p>
                                    <span className="text-xs text-muted-foreground">{convertChinaToSpain(venta.hora, currentVentas?.fecha)}</span>
                                  </div>
                                  {venta.toppings && venta.toppings.length > 0 && (
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                      {venta.toppings.map((t, idx) => (
                                        <Badge key={`${t.posicion}-${idx}`} variant="secondary" className="text-xs">
                                          {t.nombre}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <span className="font-semibold text-primary">{venta.precio.toFixed(2)} €</span>
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "ml-2 text-xs",
                                      venta.estado === 'exitoso' && "border-success/30 text-success",
                                      venta.estado === 'fallido' && "border-critical/30 text-critical"
                                    )}
                                  >
                                    {venta.estado}
                                  </Badge>
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
                        <LineChart data={tempLog.map(r => ({
                          hora: format(new Date(r.created_at), 'HH:mm', { locale: es }),
                          temperatura: Number(r.temperatura),
                          estado: r.estado,
                        }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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

            {/* Control tab removed for regular users */}
          </Tabs>
        )}
      </main>
    </div>
  );
};
