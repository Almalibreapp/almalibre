import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { DashboardSkeleton } from '@/components/ui/sales-skeleton';
import { supabase } from '@/integrations/supabase/client';
import { fetchTemperatura, fetchOrdenes } from '@/services/api';
import { fetchSpanishDayOrders } from '@/lib/sales';
import { useVentasRealtime } from '@/hooks/useVentasRealtime';
import { Euro, Thermometer, Package, AlertTriangle, IceCream } from 'lucide-react';

export const AdminDashboard = () => {
  useVentasRealtime();

  const { data: machines = [] } = useQuery({
    queryKey: ['admin-all-machines'],
    queryFn: async () => {
      const { data } = await supabase.from('maquinas').select('*');
      return (data || []) as { id: string; mac_address: string; nombre_personalizado: string; ubicacion: string | null; activa: boolean; usuario_id: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: lowStockAlerts = 0 } = useQuery({
    queryKey: ['admin-low-stock-count'],
    queryFn: async () => {
      const { count } = await supabase.from('stock_config').select('*', { count: 'exact', head: true }).lt('unidades_actuales', 20);
      return count || 0;
    },
    staleTime: 5 * 60 * 1000,
  });

  const todaySpain = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });

  const { data: ventasHoy = [], isLoading: loadingSales } = useQuery({
    queryKey: ['admin-dashboard-ventas-v2', todaySpain, machines.map(m => m.mac_address).join(',')],
    queryFn: async () => {
      if (machines.length === 0) return [];
      const uniqueByImei = Array.from(new Map(machines.map(m => [m.mac_address, m])).values());
      const promises = uniqueByImei.map(async (m) => {
        const ventas = await fetchSpanishDayOrders(m.mac_address, todaySpain, fetchOrdenes);
        return ventas.map((v: any) => ({
          id: `api-${m.id}-${v.saleUid}`,
          precio: Number(v.precio || 0),
          hora: v.horaSpain,
          fechaSpain: v.fechaSpain,
          cantidad_unidades: v.cantidad_unidades || v.cantidad || 1,
          maquina_id: m.id,
          estado: v.estado || 'exitoso',
        }));
      });
      const results = await Promise.allSettled(promises);
      const allSales = results
        .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
        .flatMap(r => r.value);
      const seen = new Set<string>();
      return allSales.filter(v => {
        if (seen.has(v.id)) return false;
        seen.add(v.id);
        return true;
      });
    },
    staleTime: 30 * 1000,
    refetchInterval: 30000,
    enabled: machines.length > 0,
  });

  const { data: tempAlerts = 0 } = useQuery({
    queryKey: ['admin-temp-alerts'],
    queryFn: async () => {
      if (machines.length === 0) return 0;
      const uniqueMachines = Array.from(new Map(machines.map(m => [m.mac_address, m])).values());
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
    const filtered = ventasHoy.filter(v => !['fallido', 'cancelado', 'failed', 'cancelled'].includes((v.estado || '').toLowerCase()));
    return {
      totalSalesToday: filtered.reduce((s, v) => s + Number(v.precio), 0),
      totalIceCreamsToday: filtered.reduce((s, v) => s + (v.cantidad_unidades || 1), 0),
      activeMachines: new Set(machines.filter(m => m.activa).map(m => m.mac_address)).size,
      totalMachines: new Set(machines.map(m => m.mac_address)).size,
      lowStockAlerts,
      tempAlerts,
    };
  }, [ventasHoy, machines, lowStockAlerts, tempAlerts]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header con gradiente */}
      <div className="rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-primary/70 p-8 text-primary-foreground">
        <h1 className="text-3xl font-display font-bold">Dashboard General</h1>
        <p className="text-primary-foreground/70 mt-1">Vista general de todas las máquinas Almalibre</p>
      </div>

      {/* KPI Grid */}
      {loadingSales && ventasHoy.length === 0 ? (
        <DashboardSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Ventas Hoy"
            value={`${metrics.totalSalesToday.toFixed(2)}€`}
            icon={<Euro className="h-6 w-6" />}
            trend="up"
          />
          <StatCard
            title="Açaí Vendidos"
            value={metrics.totalIceCreamsToday}
            icon={<IceCream className="h-6 w-6" />}
          />
          <StatCard
            title="Máquinas Activas"
            value={`${metrics.activeMachines}/${metrics.totalMachines}`}
            icon={<IceCream className="h-6 w-6" />}
          />
          <StatCard
            title="Alertas"
            value={metrics.lowStockAlerts + metrics.tempAlerts > 0
              ? `${metrics.lowStockAlerts + metrics.tempAlerts} activas`
              : 'Todo OK'}
            icon={<AlertTriangle className="h-6 w-6" />}
            trend={metrics.lowStockAlerts + metrics.tempAlerts > 0 ? 'down' : 'up'}
          />
        </div>
      )}

      {/* Alerts section */}
      {(metrics.lowStockAlerts > 0 || metrics.tempAlerts > 0) && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Alertas Urgentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {metrics.lowStockAlerts > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                <Package className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-sm font-medium">{metrics.lowStockAlerts} topping(s) con stock crítico</p>
                  <p className="text-xs text-muted-foreground">Revisar reposición</p>
                </div>
                <Badge variant="warning" className="ml-auto">Stock</Badge>
              </div>
            )}
            {metrics.tempAlerts > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                <Thermometer className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-sm font-medium">{metrics.tempAlerts} máquina(s) con temperatura fuera de rango</p>
                  <p className="text-xs text-muted-foreground">Requiere atención inmediata</p>
                </div>
                <Badge variant="destructive" className="ml-auto">Temp</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
