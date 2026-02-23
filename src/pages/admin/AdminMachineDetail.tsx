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
import { ControlTab } from '@/components/control/ControlTab';
import { supabase } from '@/integrations/supabase/client';
import { useMaquinaData, useVentasDetalle } from '@/hooks/useMaquinaData';
import { fetchVentasDetalle } from '@/services/api';
import { cn } from '@/lib/utils';
import { convertChinaToSpainFull, getChinaDatesForSpainDate } from '@/lib/timezone';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft,
  Thermometer,
  Euro,
  Package,
  Loader2,
  MapPin,
  AlertCircle,
  Gamepad2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Clock,
} from 'lucide-react';

export const AdminMachineDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [maquina, setMaquina] = useState<any>(null);
  const [loadingMachine, setLoadingMachine] = useState(true);

  useEffect(() => {
    const fetchMachine = async () => {
      const { data } = await supabase
        .from('maquinas')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      setMaquina(data);
      setLoadingMachine(false);
    };
    if (id) fetchMachine();
  }, [id]);

  const imei = maquina?.mac_address;
  const machineId = maquina?.id;
  const { temperatura, ventas, stock, isLoading, hasError, error, refetchAll, isRefetching } = useMaquinaData(imei);
  const { data: ventasDetalle } = useVentasDetalle(imei);
  const stockConfig = useStockConfig(imei);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const chinaDates = getChinaDatesForSpainDate(todayStr);

  // Fetch today's sales from DB for accurate Spain-time grouping
  const { data: ventasHoyDB } = useQuery({
    queryKey: ['admin-machine-ventas-hoy', machineId, todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('ventas_historico')
        .select('precio, hora, fecha, cantidad_unidades')
        .eq('maquina_id', machineId!)
        .in('fecha', chinaDates);
      return data || [];
    },
    enabled: !!machineId,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  // Combine DB data with API data for today's sales
  // The API returns sales in China time; DB may not be synced yet
  const ventasHoySpain = useMemo(() => {
    let euros = 0, cantidad = 0;

    // First try DB data (converted from China to Spain time)
    if (ventasHoyDB && ventasHoyDB.length > 0) {
      ventasHoyDB.forEach(v => {
        const converted = convertChinaToSpainFull(v.hora, v.fecha);
        if (converted.fecha === todayStr) {
          euros += Number(v.precio);
          cantidad += (v.cantidad_unidades || 1);
        }
      });
    }

    // If DB has no data for today, use API ventas-detalle as fallback
    if (cantidad === 0 && ventasDetalle?.ventas) {
      ventasDetalle.ventas.forEach((v: any) => {
        const converted = convertChinaToSpainFull(v.hora, ventasDetalle.fecha);
        if (converted.fecha === todayStr) {
          euros += Number(v.precio);
          cantidad += (v.cantidad_unidades || 1);
        }
      });
    }

    return { euros, cantidad };
  }, [ventasHoyDB, ventasDetalle, todayStr]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAllSales, setShowAllSales] = useState(false);

  const getSelectedDateStr = () => selectedDate || undefined;

  const navigateDate = (direction: 'prev' | 'next') => {
    const current = selectedDate ? new Date(selectedDate) : new Date();
    current.setDate(current.getDate() + (direction === 'prev' ? -1 : 1));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    current.setHours(0, 0, 0, 0);
    setSelectedDate(current >= today ? null : current.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === null;
  const displayDate = selectedDate
    ? format(new Date(selectedDate), "EEEE d 'de' MMMM", { locale: es })
    : 'Hoy';

  const { data: ventasSelectedDate, isLoading: loadingSelected } = useQuery({
    queryKey: ['ventas-detalle-date', imei, getSelectedDateStr()],
    queryFn: () => fetchVentasDetalle(imei!, getSelectedDateStr()),
    enabled: !!imei && !isToday,
  });

  const currentVentas = isToday ? ventasDetalle : ventasSelectedDate;

  if (loadingMachine) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!maquina) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Máquina no encontrada</p>
        <Button variant="link" onClick={() => navigate('/admin/machines')}>Volver</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/machines')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{maquina.nombre_personalizado}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {maquina.ubicacion && (
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{maquina.ubicacion}</span>
            )}
            <span className="font-mono text-xs">IMEI: {imei}</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : hasError ? (
        <Card className="border-warning/50">
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-10 w-10 text-warning mx-auto mb-3" />
            <p className="text-muted-foreground">{error?.message || 'Sin datos disponibles'}</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">General</TabsTrigger>
            <TabsTrigger value="sales">Ventas</TabsTrigger>
            <TabsTrigger value="stock">Stock</TabsTrigger>
            <TabsTrigger value="control" className="flex items-center gap-1">
              <Gamepad2 className="h-3 w-3" />
              Control
            </TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Thermometer className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-3xl font-bold text-primary">
                    {temperatura?.temperatura !== undefined ? `${temperatura.temperatura}°C` : '--'}
                  </p>
                  <Badge className={cn(
                    "mt-1",
                    temperatura?.temperatura !== undefined && temperatura.temperatura >= 11 && "bg-critical text-critical-foreground",
                    temperatura?.temperatura !== undefined && temperatura.temperatura < 11 && "bg-success text-success-foreground",
                    temperatura?.temperatura === undefined && "bg-muted text-muted-foreground",
                  )}>
                    {temperatura?.temperatura !== undefined ? (temperatura.temperatura >= 11 ? 'Crítico' : 'Normal') : 'Sin datos'}
                  </Badge>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Euro className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-3xl font-bold text-primary">{ventasHoySpain.euros.toFixed(2)}€</p>
                  <p className="text-xs text-muted-foreground">{ventasHoySpain.cantidad} ventas hoy</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Package className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-3xl font-bold">{stock?.total_toppings ?? 0}</p>
                  <p className="text-xs text-muted-foreground">toppings configurados</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Sales */}
          <TabsContent value="sales" className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => navigateDate('prev')}>
                <ChevronLeft className="h-4 w-4 mr-1" />Anterior
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
                Siguiente<ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />Ventas por Hora
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SalesChart ventas={currentVentas?.ventas || []} fecha={currentVentas?.fecha} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stock */}
          <TabsContent value="stock" className="space-y-4">
            <StockCapacitySettings imei={imei!} stock={stock} stockConfig={stockConfig} />
            <StockReplenishment imei={imei!} stock={stock} stockConfig={stockConfig} />
          </TabsContent>

          {/* Control - Only for admin */}
          <TabsContent value="control" className="space-y-4">
            <ControlTab imei={imei!} ubicacion={maquina.ubicacion || ''} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
