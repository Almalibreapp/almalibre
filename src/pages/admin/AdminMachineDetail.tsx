import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { StockReplenishment } from '@/components/stock/StockReplenishment';
import { StockCapacitySettings } from '@/components/stock/StockCapacitySettings';
import { useStockConfig } from '@/hooks/useStockConfig';
import { useStockSync } from '@/hooks/useStockSync';
import { ControlTab } from '@/components/control/ControlTab';
import { TemperatureTraceability } from '@/components/temperature/TemperatureTraceability';
import { supabase } from '@/integrations/supabase/client';
import { useMaquinaData, useVentasDetalle } from '@/hooks/useMaquinaData';
import { useVentasRealtime } from '@/hooks/useVentasRealtime';
import { fetchOrdenes, fetchEstadoMaquina } from '@/services/api';
import { cn } from '@/lib/utils';
import { convertChinaToSpainFull } from '@/lib/timezone';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft, Thermometer, Euro, Package, Loader2, MapPin, AlertCircle, Gamepad2,
  ChevronLeft, ChevronRight, Clock, Activity, CheckCircle, AlertTriangle, XCircle,
  Snowflake, Circle,
} from 'lucide-react';

export const AdminMachineDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [maquina, setMaquina] = useState<any>(null);
  const [loadingMachine, setLoadingMachine] = useState(true);

  useEffect(() => {
    const fetchMachine = async () => {
      const { data } = await supabase.from('maquinas').select('*').eq('id', id!).maybeSingle();
      setMaquina(data);
      setLoadingMachine(false);
    };
    if (id) fetchMachine();
  }, [id]);

  const imei = maquina?.mac_address;
  const machineId = maquina?.id;
  const { temperatura, ventas, stock, isLoading, hasError, error } = useMaquinaData(imei);
  const { data: ventasDetalle } = useVentasDetalle(imei);
  const stockConfig = useStockConfig(imei);
  useStockSync(imei);
  useVentasRealtime(imei);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Today's sales from API
  const { data: ventasHoyAPI } = useQuery({
    queryKey: ['admin-machine-ventas-hoy-api', imei, todayStr],
    queryFn: async () => {
      const detalle = await fetchOrdenes(imei!);
      if (!detalle?.ventas) return [];
      return detalle.ventas.map((v: any) => ({
        precio: Number(v.precio || 0),
        hora: v.hora || '00:00',
        fecha: (detalle.fecha || todayStr).substring(0, 10),
        cantidad_unidades: v.cantidad_unidades || v.cantidad || 1,
        estado: v.estado || 'exitoso',
      }));
    },
    enabled: !!imei,
    refetchInterval: 30000,
  });

  const ventasHoySpain = useMemo(() => {
    let euros = 0, cantidad = 0;
    if (ventasHoyAPI) {
      ventasHoyAPI.forEach(v => {
        if (v.estado === 'fallido') return;
        const converted = convertChinaToSpainFull(v.hora, v.fecha);
        if (converted.fecha === todayStr) { euros += Number(v.precio); cantidad += (v.cantidad_unidades || 1); }
      });
    }
    return { euros, cantidad };
  }, [ventasHoyAPI, todayStr]);

  // Machine estado
  const { data: estadoMaquina, isLoading: loadingEstado } = useQuery({
    queryKey: ['admin-machine-estado', imei],
    queryFn: () => fetchEstadoMaquina(imei!),
    enabled: !!imei,
    refetchInterval: 2 * 60 * 1000, // Auto-refresh every 2 minutes
    retry: 1,
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const navigateDate = (direction: 'prev' | 'next') => {
    const current = selectedDate ? new Date(selectedDate) : new Date();
    current.setDate(current.getDate() + (direction === 'prev' ? -1 : 1));
    const today = new Date(); today.setHours(0, 0, 0, 0); current.setHours(0, 0, 0, 0);
    setSelectedDate(current >= today ? null : current.toISOString().split('T')[0]);
  };
  const isToday = selectedDate === null;
  const displayDate = selectedDate ? format(new Date(selectedDate), "EEEE d 'de' MMMM", { locale: es }) : 'Hoy';

  const { data: ventasSelectedDate } = useQuery({
    queryKey: ['ventas-ordenes-date', imei, selectedDate],
    queryFn: () => fetchOrdenes(imei!, selectedDate!),
    enabled: !!imei && !isToday && !!selectedDate,
  });
  const currentVentas = isToday ? ventasDetalle : ventasSelectedDate;

  if (loadingMachine) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!maquina) return <div className="text-center py-12"><p className="text-muted-foreground">Máquina no encontrada</p><Button variant="link" onClick={() => navigate('/admin/machines')}>Volver</Button></div>;

  const getEstadoBadge = () => {
    const estado = estadoMaquina?.estado_general || 'unknown';
    if (estado === 'ok') return <Badge className="bg-success text-success-foreground text-lg px-4 py-2">🟢 OK</Badge>;
    if (estado === 'alerta') return <Badge className="bg-warning text-warning-foreground text-lg px-4 py-2">🟡 ALERTA</Badge>;
    if (estado === 'error') return <Badge variant="destructive" className="text-lg px-4 py-2">🔴 ERROR</Badge>;
    return <Badge variant="secondary" className="text-lg px-4 py-2">Desconocido</Badge>;
  };

  const getComponentIcon = (name: string) => {
    if (name.toLowerCase().includes('refriger') || name.toLowerCase().includes('frio')) return <Snowflake className="h-4 w-4" />;
    if (name.toLowerCase().includes('tarrina') || name.toLowerCase().includes('vaso')) return <Package className="h-4 w-4" />;
    return <Circle className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/machines')}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-xl font-bold">{maquina.nombre_personalizado}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {maquina.ubicacion && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{maquina.ubicacion}</span>}
            <span className="font-mono text-xs">IMEI: {imei}</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : hasError ? (
        <Card className="border-warning/50"><CardContent className="py-8 text-center"><AlertCircle className="h-10 w-10 text-warning mx-auto mb-3" /><p className="text-muted-foreground">{error?.message || 'Sin datos disponibles'}</p></CardContent></Card>
      ) : (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">General</TabsTrigger>
            <TabsTrigger value="estado" className="flex items-center gap-1"><Activity className="h-3 w-3" />Estado</TabsTrigger>
            <TabsTrigger value="sales">Ventas</TabsTrigger>
            <TabsTrigger value="stock">Stock</TabsTrigger>
            <TabsTrigger value="control" className="flex items-center gap-1"><Gamepad2 className="h-3 w-3" />Control</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card><CardContent className="p-4 text-center"><Thermometer className="h-5 w-5 text-primary mx-auto mb-2" /><p className="text-3xl font-bold text-primary">{temperatura?.temperatura !== undefined ? `${temperatura.temperatura}°C` : '--'}</p><Badge className={cn("mt-1", temperatura?.temperatura !== undefined && temperatura.temperatura >= 11 && "bg-critical text-critical-foreground", temperatura?.temperatura !== undefined && temperatura.temperatura < 11 && "bg-success text-success-foreground", temperatura?.temperatura === undefined && "bg-muted text-muted-foreground")}>{temperatura?.temperatura !== undefined ? (temperatura.temperatura >= 11 ? 'Crítico' : 'Normal') : 'Sin datos'}</Badge></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><Euro className="h-5 w-5 text-primary mx-auto mb-2" /><p className="text-3xl font-bold text-primary">{ventasHoySpain.euros.toFixed(2)}€</p><p className="text-xs text-muted-foreground">{ventasHoySpain.cantidad} ventas hoy</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><Package className="h-5 w-5 text-primary mx-auto mb-2" /><p className="text-3xl font-bold">{stock?.total_toppings ?? 0}</p><p className="text-xs text-muted-foreground">toppings configurados</p></CardContent></Card>
            </div>
            <TemperatureTraceability maquinaId={machineId} temperatura={temperatura} imei={imei} />
          </TabsContent>

          {/* Estado */}
          <TabsContent value="estado" className="space-y-4">
            {loadingEstado ? (
              <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : !estadoMaquina ? (
              <Card><CardContent className="py-12 text-center"><Activity className="h-12 w-12 mx-auto mb-4 opacity-30" /><p className="text-lg font-medium text-muted-foreground">No se pudo obtener el estado</p><p className="text-sm text-muted-foreground">El endpoint de estado no está disponible</p></CardContent></Card>
            ) : (
              <>
                {/* Estado general prominente */}
                <Card><CardContent className="p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-3">Estado General</p>
                  {getEstadoBadge()}
                </CardContent></Card>

                {/* Errores */}
                {estadoMaquina.errores && estadoMaquina.errores.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-critical flex items-center gap-2"><XCircle className="h-5 w-5" /> Errores ({estadoMaquina.errores.length})</h3>
                    {estadoMaquina.errores.map((err: any, i: number) => (
                      <Card key={i} className="border-critical/50 bg-critical/5">
                        <CardContent className="p-4 flex items-start gap-3">
                          <XCircle className="h-5 w-5 text-critical flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">{err.codigo || `Error ${i + 1}`}</p>
                            <p className="text-sm text-muted-foreground">{err.mensaje || err.descripcion || JSON.stringify(err)}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Alertas */}
                {estadoMaquina.alertas && estadoMaquina.alertas.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-warning flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Alertas ({estadoMaquina.alertas.length})</h3>
                    {estadoMaquina.alertas.map((alerta: any, i: number) => (
                      <Card key={i} className="border-warning/50 bg-warning/5">
                        <CardContent className="p-4 flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium">{alerta.codigo || `Alerta ${i + 1}`}</p>
                            <p className="text-sm text-muted-foreground">{alerta.mensaje || alerta.descripcion || JSON.stringify(alerta)}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Estado de componentes */}
                {estadoMaquina.componentes && estadoMaquina.componentes.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Estado de Componentes</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {estadoMaquina.componentes.map((comp: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-3">
                            {getComponentIcon(comp.nombre || '')}
                            <span className="font-medium text-sm">{comp.nombre || `Componente ${i + 1}`}</span>
                          </div>
                          <Badge className={cn(
                            comp.estado === 'ok' && "bg-success text-success-foreground",
                            comp.estado === 'alerta' && "bg-warning text-warning-foreground",
                            comp.estado === 'error' && "bg-critical text-critical-foreground",
                            !['ok', 'alerta', 'error'].includes(comp.estado) && "bg-muted text-muted-foreground",
                          )}>
                            {comp.estado === 'ok' ? <CheckCircle className="h-3 w-3 mr-1" /> : comp.estado === 'error' ? <XCircle className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                            {comp.estado || 'Desconocido'}
                          </Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Sin errores ni alertas */}
                {(!estadoMaquina.errores || estadoMaquina.errores.length === 0) && (!estadoMaquina.alertas || estadoMaquina.alertas.length === 0) && (
                  <Card className="border-success/30 bg-success/5"><CardContent className="p-6 text-center">
                    <CheckCircle className="h-12 w-12 text-success mx-auto mb-3" />
                    <p className="text-lg font-medium">Sin errores ni alertas</p>
                    <p className="text-sm text-muted-foreground">La máquina funciona correctamente</p>
                  </CardContent></Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Sales */}
          <TabsContent value="sales" className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => navigateDate('prev')}><ChevronLeft className="h-4 w-4 mr-1" />Anterior</Button>
              <div className="text-center"><p className="font-medium capitalize text-sm">{displayDate}</p>{selectedDate && <Button variant="link" size="sm" className="text-xs p-0 h-auto" onClick={() => setSelectedDate(null)}>Volver a hoy</Button>}</div>
              <Button variant="outline" size="sm" onClick={() => navigateDate('next')} disabled={isToday}>Siguiente<ChevronRight className="h-4 w-4 ml-1" /></Button>
            </div>
            <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />Ventas por Hora</CardTitle></CardHeader><CardContent>
              <SalesChart ventas={currentVentas?.ventas || []} fecha={currentVentas?.fecha} />
            </CardContent></Card>
          </TabsContent>

          {/* Stock */}
          <TabsContent value="stock" className="space-y-4">
            <StockCapacitySettings imei={imei!} stock={stock} stockConfig={stockConfig} />
            <StockReplenishment imei={imei!} stock={stock} stockConfig={stockConfig} />
          </TabsContent>

          {/* Control */}
          <TabsContent value="control" className="space-y-4">
            <ControlTab imei={imei!} ubicacion={maquina.ubicacion || ''} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
