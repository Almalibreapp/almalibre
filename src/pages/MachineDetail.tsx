import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { StockBar } from '@/components/dashboard/StockBar';
import { TemperatureChart } from '@/components/dashboard/TemperatureChart';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { ControlTab } from '@/components/control/ControlTab';
import { useAuth } from '@/hooks/useAuth';
import { useMaquinas } from '@/hooks/useMaquinas';
import { useMaquinaData, useVentasDetalle } from '@/hooks/useMaquinaData';
import { fetchVentasDetalle } from '@/services/api';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Settings,
  Thermometer,
  Euro,
  Package,
  RefreshCw,
  Loader2,
  MapPin,
  TrendingUp,
  AlertCircle,
  Gamepad2,
  ChevronLeft,
  ChevronRight,
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
  
  // State for viewing yesterday's sales
  const [viewingYesterday, setViewingYesterday] = useState(false);
  
  // Calculate yesterday's date
  const getYesterdayDate = () => {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    return ayer.toISOString().split('T')[0];
  };
  
  // Query for yesterday's sales
  const { data: ventasAyer, isLoading: loadingAyer } = useQuery({
    queryKey: ['ventas-detalle-ayer', imei, getYesterdayDate()],
    queryFn: () => fetchVentasDetalle(imei!, getYesterdayDate()),
    enabled: !!imei && viewingYesterday,
  });

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

  const getTempStatusBadge = (estado?: string) => {
    switch (estado) {
      case 'normal':
        return <Badge className="bg-success-light text-success border-success/30">Normal</Badge>;
      case 'alerta':
        return <Badge className="bg-warning-light text-warning border-warning/30">Alerta</Badge>;
      case 'critico':
        return <Badge className="bg-critical-light text-critical border-critical/30">Crítico</Badge>;
      default:
        return null;
    }
  };

  const lowStockToppings = stock?.toppings?.filter(
    (t) => t.capacidad_maxima > 0 && t.stock_actual / t.capacidad_maxima < 0.2
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
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">General</TabsTrigger>
              <TabsTrigger value="sales">Ventas</TabsTrigger>
              <TabsTrigger value="stock">Stock</TabsTrigger>
              <TabsTrigger value="temp">Temp</TabsTrigger>
              <TabsTrigger value="control" className="flex items-center gap-1">
                <Gamepad2 className="h-3 w-3" />
                <span className="hidden sm:inline">Control</span>
              </TabsTrigger>
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
                    {getTempStatusBadge(temperatura?.estado)}
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
              {/* Day Toggle */}
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant={!viewingYesterday ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewingYesterday(false)}
                >
                  Hoy
                </Button>
                <Button
                  variant={viewingYesterday ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewingYesterday(true)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Ayer
                </Button>
              </div>

              {viewingYesterday && loadingAyer ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Ventas {viewingYesterday ? 'de Ayer' : 'del Día'} {(viewingYesterday ? ventasAyer?.fecha : ventasDetalle?.fecha) ? `- ${viewingYesterday ? ventasAyer?.fecha : ventasDetalle?.fecha}` : ''}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <SalesChart 
                        ventas={(viewingYesterday ? ventasAyer?.ventas : ventasDetalle?.ventas) || []} 
                        fecha={(viewingYesterday ? ventasAyer?.fecha : ventasDetalle?.fecha)} 
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Ventas Recientes</CardTitle>
                        {(viewingYesterday ? ventasAyer?.total_ventas : ventasDetalle?.total_ventas) !== undefined && (
                          <Badge variant="secondary">
                            {viewingYesterday ? ventasAyer?.total_ventas : ventasDetalle?.total_ventas} ventas {viewingYesterday ? 'ayer' : 'hoy'}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {((viewingYesterday ? ventasAyer?.ventas : ventasDetalle?.ventas) || []).length > 0 ? (
                        <div className="space-y-3">
                          {((viewingYesterday ? ventasAyer?.ventas : ventasDetalle?.ventas) || []).slice(0, 10).map((venta) => (
                            <div
                              key={venta.id}
                              className="flex items-center justify-between py-2 border-b last:border-0"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium capitalize">{venta.producto}</p>
                                  <span className="text-xs text-muted-foreground">{venta.hora}</span>
                                </div>
                                {venta.toppings && venta.toppings.length > 0 && (
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    {venta.toppings.map((t, idx) => (
                                      <Badge
                                        key={`${t.posicion}-${idx}`}
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {t.nombre}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="font-semibold text-primary">
                                  {venta.precio.toFixed(2)} €
                                </span>
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
                      ) : (
                        <p className="text-center text-muted-foreground py-8">
                          No hay ventas registradas {viewingYesterday ? 'ayer' : 'hoy'}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* Stock Tab */}
            <TabsContent value="stock" className="space-y-4 animate-fade-in">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Inventario de Toppings</CardTitle>
                    {stock?.total_toppings !== undefined && (
                      <Badge variant="secondary">{stock.total_toppings} toppings</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {stock?.toppings && stock.toppings.length > 0 ? (
                    stock.toppings.map((topping) => (
                      <StockBar
                        key={topping.posicion}
                        nombre={topping.nombre}
                        posicion={topping.posicion}
                        stockActual={topping.stock_actual}
                        capacidadMaxima={topping.capacidad_maxima}
                      />
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Sin datos de stock disponibles
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Temperature Tab */}
            <TabsContent value="temp" className="space-y-4 animate-fade-in">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Temperatura Actual</CardTitle>
                    {getTempStatusBadge(temperatura?.estado)}
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Historial de Temperatura</CardTitle>
                </CardHeader>
                <CardContent>
                  <TemperatureChart temperaturaActual={temperatura} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Control Tab */}
            <TabsContent value="control" className="space-y-4">
              <ControlTab imei={imei!} ubicacion={maquina.ubicacion || ''} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};
