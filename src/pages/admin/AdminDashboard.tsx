import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { fetchTemperatura } from '@/services/api';
import { convertChinaToSpainFull } from '@/lib/timezone';
import { format } from 'date-fns';
import { useVentasRealtime } from '@/hooks/useVentasRealtime';
import { IceCream, Euro, Thermometer, Package, AlertTriangle, Loader2 } from 'lucide-react';

const todayStr = format(new Date(), 'yyyy-MM-dd');

export const AdminDashboard = () => {
  useVentasRealtime();
  // Fetch all machines
  const { data: machines = [] } = useQuery({
    queryKey: ['admin-all-machines'],
    queryFn: async () => {
      const { data } = await supabase.from('maquinas').select('*');
      return (data || []) as { id: string; mac_address: string; nombre_personalizado: string; ubicacion: string | null; activa: boolean; usuario_id: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch low stock count
  const { data: lowStockAlerts = 0 } = useQuery({
    queryKey: ['admin-low-stock-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('stock_config')
        .select('*', { count: 'exact', head: true })
        .lt('unidades_actuales', 20);
      return count || 0;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch today's sales - ALWAYS use API for real-time accuracy
  const { data: ventasHoy = [], isLoading: loadingSales } = useQuery({
    queryKey: ['admin-dashboard-ventas', todayStr, machines.map(m => m.mac_address).join(',')],
    queryFn: async () => {
      if (machines.length === 0) return [];

      // Always fetch from API for today to guarantee real-time data
      const uniqueByImei = Array.from(
        new Map(machines.map(m => [m.mac_address, m])).values()
      );

      const apiPromises = uniqueByImei.map(async (m) => {
        try {
          const apiRes = await fetch(
            `https://nonstopmachine.com/wp-json/fabricante-ext/v1/ordenes/${m.mac_address}?fecha=${todayStr}`,
            { headers: { 'Authorization': 'Bearer b7Jm3xZt92Qh!fRAp4wLkN8sX0cTe6VuY1oGz5rH@MiPqDaE', 'Content-Type': 'application/json' } }
          );
          if (!apiRes.ok) return [];
          const detalle = await apiRes.json();
          const orders = detalle?.ordenes || detalle?.ventas || [];
          console.log(`[AdminDashboard] API ${m.nombre_personalizado}: ${orders.length} ventas`);
          return orders.map((v: any) => ({
            precio: Number(v.precio || 0),
            hora: v.hora || '00:00',
            fecha: v.fecha || detalle?.fecha || todayStr,
            cantidad_unidades: v.cantidad_unidades || v.cantidad || 1,
            maquina_id: m.id,
          }));
        } catch { return []; }
      });

      const results = await Promise.allSettled(apiPromises);
      const allSales = results
        .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
        .flatMap(r => r.value);

      console.log(`[AdminDashboard] Total ventas hoy desde API: ${allSales.length}`);
      return allSales;
    },
    staleTime: 30 * 1000,
    refetchInterval: 30000,
    enabled: machines.length > 0,
  });

  // Fetch temp alerts
  const { data: tempAlerts = 0 } = useQuery({
    queryKey: ['admin-temp-alerts'],
    queryFn: async () => {
      if (machines.length === 0) return 0;
      const uniqueMachines = Array.from(
        new Map(machines.map(m => [m.mac_address, m])).values()
      );
      let count = 0;
      const promises = uniqueMachines.map(async (m) => {
        try {
          const temp = await fetchTemperatura(m.mac_address);
          if (temp?.temperatura !== undefined && temp.temperatura >= 11) count++;
        } catch { /* skip */ }
      });
      await Promise.allSettled(promises);
      return count;
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 30000,
    enabled: machines.length > 0,
  });

  const metrics = useMemo(() => {
    const filtered = ventasHoy.filter(v => {
      const converted = convertChinaToSpainFull(v.hora, v.fecha);
      return converted.fecha === todayStr;
    });

    const totalSales = filtered.reduce((s, v) => s + Number(v.precio), 0);
    const totalIceCreams = filtered.reduce((s, v) => s + (v.cantidad_unidades || 1), 0);

    const uniqueImeis = new Set(machines.map(m => m.mac_address));
    const uniqueActiveImeis = new Set(machines.filter(m => m.activa).map(m => m.mac_address));

    return {
      totalSalesToday: totalSales,
      totalIceCreamsToday: totalIceCreams,
      activeMachines: uniqueActiveImeis.size,
      totalMachines: uniqueImeis.size,
      lowStockAlerts,
      tempAlerts,
    };
  }, [ventasHoy, machines, lowStockAlerts, tempAlerts]);

  if (loadingSales && ventasHoy.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Dashboard General</h1>
        <p className="text-muted-foreground">Vista general de todas las máquinas Almalibre</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ventas Hoy</p>
                <p className="text-3xl font-bold text-primary">{metrics.totalSalesToday.toFixed(2)}€</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Euro className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Açaí Vendidos</p>
                <p className="text-3xl font-bold">{metrics.totalIceCreamsToday}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                <IceCream className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Máquinas</p>
                <p className="text-3xl font-bold">{metrics.activeMachines}/{metrics.totalMachines}</p>
                <p className="text-xs text-muted-foreground">activas</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center">
                <IceCream className="h-6 w-6 text-accent-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alertas</p>
                <div className="flex items-center gap-2">
                  {metrics.lowStockAlerts > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      <Package className="h-3 w-3 mr-1" /> {metrics.lowStockAlerts} stock
                    </Badge>
                  )}
                  {metrics.tempAlerts > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      <Thermometer className="h-3 w-3 mr-1" /> {metrics.tempAlerts} temp
                    </Badge>
                  )}
                  {metrics.lowStockAlerts === 0 && metrics.tempAlerts === 0 && (
                    <p className="text-lg font-bold text-success">Todo OK</p>
                  )}
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick alerts */}
      {(metrics.lowStockAlerts > 0 || metrics.tempAlerts > 0) && (
        <Card className="border-warning/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" />
              Alertas Urgentes
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {metrics.lowStockAlerts > 0 && (
              <p>• {metrics.lowStockAlerts} topping(s) con stock crítico</p>
            )}
            {metrics.tempAlerts > 0 && (
              <p>• {metrics.tempAlerts} máquina(s) con temperatura fuera de rango</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
