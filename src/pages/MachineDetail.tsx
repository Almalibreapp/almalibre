import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { StockBar } from '@/components/dashboard/StockBar';
import { TemperatureChart } from '@/components/dashboard/TemperatureChart';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { useAuth } from '@/hooks/useAuth';
import { useMaquinas } from '@/hooks/useMaquinas';
import { fetchStock, fetchTemperatura, fetchVentas } from '@/services/api';
import { StockResponse, TemperaturaResponse, VentasResponse } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Settings,
  Thermometer,
  DollarSign,
  Package,
  RefreshCw,
  Loader2,
  MapPin,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

export const MachineDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { maquinas } = useMaquinas(user?.id);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [temperatura, setTemperatura] = useState<TemperaturaResponse | null>(null);
  const [ventas, setVentas] = useState<VentasResponse | null>(null);
  const [stock, setStock] = useState<StockResponse | null>(null);

  const maquina = maquinas.find((m) => m.id === id);

  const loadData = async () => {
    if (!maquina) return;
    
    try {
      const [tempData, ventasData, stockData] = await Promise.all([
        fetchTemperatura(maquina.mac_address),
        fetchVentas(maquina.mac_address),
        fetchStock(maquina.mac_address),
      ]);
      setTemperatura(tempData);
      setVentas(ventasData);
      setStock(stockData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (maquina) {
      loadData();
    }
  }, [maquina]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

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

  const lowStockToppings = stock?.toppings.filter(
    (t) => t.stock_actual / t.capacidad_maxima < 0.2
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
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-5 w-5", refreshing && "animate-spin")} />
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
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                    {getTempStatusBadge(temperatura?.estado)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-primary mb-4">
                    {temperatura?.temperatura_actual?.toFixed(1)}°C
                  </div>
                  <TemperatureChart historial={temperatura?.historial || []} />
                </CardContent>
              </Card>

              {/* Sales Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Ventas de Hoy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-bold text-primary">
                      ${ventas?.total_ingresos?.toFixed(2) || '0.00'}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({ventas?.total_ventas || 0} ventas)
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-success">
                    <TrendingUp className="h-4 w-4" />
                    <span>+12% vs ayer</span>
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ventas Últimos 7 Días</CardTitle>
                </CardHeader>
                <CardContent>
                  <SalesChart ventas={ventas?.ventas || []} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ventas Recientes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {ventas?.ventas.slice(0, 10).map((venta) => (
                      <div
                        key={venta.id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div>
                          <p className="font-medium">{venta.producto_nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(venta.fecha), "d MMM, HH:mm", { locale: es })}
                          </p>
                          <div className="flex gap-1 mt-1">
                            {venta.toppings_usados.map((t) => (
                              <Badge
                                key={t.posicion}
                                variant="secondary"
                                className="text-xs"
                              >
                                {t.nombre}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <span className="font-semibold text-primary">
                          ${venta.producto_monto.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Stock Tab */}
            <TabsContent value="stock" className="space-y-4 animate-fade-in">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Inventario de Toppings</CardTitle>
                    <span className="text-xs text-muted-foreground">
                      Actualizado: {stock?.fecha_actualizacion 
                        ? format(new Date(stock.fecha_actualizacion), "d MMM, HH:mm", { locale: es })
                        : '--'
                      }
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {stock?.toppings.map((topping) => (
                    <StockBar
                      key={topping.posicion}
                      nombre={topping.nombre}
                      posicion={topping.posicion}
                      stockActual={topping.stock_actual}
                      capacidadMaxima={topping.capacidad_maxima}
                    />
                  ))}
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
                    {temperatura?.temperatura_actual?.toFixed(1)}°C
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Historial 24 Horas</CardTitle>
                </CardHeader>
                <CardContent>
                  <TemperatureChart historial={temperatura?.historial || []} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Registro de Temperatura</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {temperatura?.historial.slice(0, 12).map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(item.fecha), "d MMM, HH:mm", { locale: es })}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.temperatura.toFixed(1)}°C</span>
                          {getTempStatusBadge(item.estado)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};
