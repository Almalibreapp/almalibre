import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { fetchTemperatura, fetchOrdenes } from '@/services/api';
import { format } from 'date-fns';
import { useVentasRealtime } from '@/hooks/useVentasRealtime';
import { convertChinaToSpainFull } from '@/lib/timezone';
import { IceCream, Euro, Thermometer, Package, AlertTriangle, Loader2 } from 'lucide-react';

export const AdminDashboard = () => {
  useVentasRealtime();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = format(tomorrowDate, 'yyyy-MM-dd');

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

  // Fetch today's sales: query both todayStr and tomorrowStr (China dates),
  // then filter by Spanish date = todayStr
  const { data: ventasHoy = [], isLoading: loadingSales } = useQuery({
    queryKey: ['admin-dashboard-ventas', todayStr, machines.map(m => m.mac_address).join(',')],
    queryFn: async () => {
      if (machines.length === 0) return [];
      const uniqueByImei = Array.from(new Map(machines.map(m => [m.mac_address, m])).values());

      const fetchForDate = async (apiDate: string) => {
        const promises = uniqueByImei.map(async (m) => {
          try {
            const detalle = await fetchOrdenes(m.mac_address, apiDate);
            if (!detalle?.ventas) return [];
            return detalle.ventas.map((v: any) => {
              const chinaFecha = (v.fecha || detalle.fecha || apiDate).substring(0, 10);
              const chinaHora = v.hora || '00:00';
              const spain = convertChinaToSpainFull(chinaHora, chinaFecha);
              return {
                id: v.id || v.numero_orden || `${m.id}-${chinaHora}-${v.precio}-${Math.random()}`,
                precio: Number(v.precio || 0),
                hora: chinaHora,
                fechaSpain: spain.fecha,
                cantidad_unidades: v.cantidad_unidades || v.cantidad || 1,
                maquina_id: m.id,
                estado: v.estado || 'exitoso',
              };
            });
          } catch { return []; }
        });
        const results = await Promise.allSettled(promises);
        return results
          .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
          .flatMap(r => r.value);
      };

      const [salesToday, salesTomorrow] = await Promise.all([
        fetchForDate(todayStr),
        fetchForDate(tomorrowStr),
      ]);

      const allSales = [...salesToday, ...salesTomorrow].filter(v => v.fechaSpain === todayStr);

      const seen = new Set<string>();
      return allSales.filter(v => {
        const key = v.id;
        if (seen.has(key)) return false;
        seen.add(key);
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
    const filtered = ventasHoy.filter(v => v.estado !== 'fallido');

    return {
      totalSalesToday: filtered.reduce((s, v) => s + Number(v.precio), 0),
      totalIceCreamsToday: filtered.reduce((s, v) => s + (v.cantidad_unidades || 1), 0),
      activeMachines: new Set(machines.filter(m => m.activa).map(m => m.mac_address)).size,
      totalMachines: new Set(machines.map(m => m.mac_address)).size,
      lowStockAlerts,
      tempAlerts,
    };
  }, [ventasHoy, machines, lowStockAlerts, tempAlerts, todayStr]);

  if (loadingSales && ventasHoy.length === 0) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Dashboard General</h1>
        <p className="text-muted-foreground">Vista general de todas las máquinas Almalibre</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Ventas Hoy</p><p className="text-3xl font-bold text-primary">{metrics.totalSalesToday.toFixed(2)}€</p></div><div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center"><Euro className="h-6 w-6 text-primary" /></div></div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Açaí Vendidos</p><p className="text-3xl font-bold">{metrics.totalIceCreamsToday}</p></div><div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center"><IceCream className="h-6 w-6 text-success" /></div></div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Máquinas</p><p className="text-3xl font-bold">{metrics.activeMachines}/{metrics.totalMachines}</p><p className="text-xs text-muted-foreground">activas</p></div><div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center"><IceCream className="h-6 w-6 text-accent-foreground" /></div></div></CardContent></Card>
        <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Alertas</p><div className="flex items-center gap-2">
          {metrics.lowStockAlerts > 0 && <Badge variant="destructive" className="text-xs"><Package className="h-3 w-3 mr-1" /> {metrics.lowStockAlerts} stock</Badge>}
          {metrics.tempAlerts > 0 && <Badge variant="destructive" className="text-xs"><Thermometer className="h-3 w-3 mr-1" /> {metrics.tempAlerts} temp</Badge>}
          {metrics.lowStockAlerts === 0 && metrics.tempAlerts === 0 && <p className="text-lg font-bold text-success">Todo OK</p>}
        </div></div><div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center"><AlertTriangle className="h-6 w-6 text-warning" /></div></div></CardContent></Card>
      </div>

      {(metrics.lowStockAlerts > 0 || metrics.tempAlerts > 0) && (
        <Card className="border-warning/50"><CardHeader><CardTitle className="text-base flex items-center gap-2 text-warning"><AlertTriangle className="h-4 w-4" />Alertas Urgentes</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">
          {metrics.lowStockAlerts > 0 && <p>• {metrics.lowStockAlerts} topping(s) con stock crítico</p>}
          {metrics.tempAlerts > 0 && <p>• {metrics.tempAlerts} máquina(s) con temperatura fuera de rango</p>}
        </CardContent></Card>
      )}
    </div>
  );
};
