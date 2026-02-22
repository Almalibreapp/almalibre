import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { fetchTemperatura } from '@/services/api';
import { convertChinaToSpainFull, getChinaDatesForSpainDate } from '@/lib/timezone';
import { format } from 'date-fns';
import { IceCream, Euro, Thermometer, Package, AlertTriangle, Loader2 } from 'lucide-react';

interface MachineWithUser {
  id: string;
  mac_address: string;
  nombre_personalizado: string;
  ubicacion: string | null;
  activa: boolean;
  usuario_id: string;
}

export const AdminDashboard = () => {
  const [machines, setMachines] = useState<MachineWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tempAlerts, setTempAlerts] = useState(0);
  const [lowStockAlerts, setLowStockAlerts] = useState(0);
  const [ventasHoy, setVentasHoy] = useState<any[]>([]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const chinaDates = getChinaDatesForSpainDate(todayStr);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      // Fetch all machines
      const { data: maquinas } = await supabase
        .from('maquinas')
        .select('*');

      if (!maquinas) return;
      setMachines(maquinas as MachineWithUser[]);

      // Fetch low stock alerts
      const { count: lowStock } = await supabase
        .from('stock_config')
        .select('*', { count: 'exact', head: true })
        .lt('unidades_actuales', 20);
      setLowStockAlerts(lowStock || 0);

      // Fetch today's sales from DB (using China date range for Spain today)
      const { data: ventas } = await supabase
        .from('ventas_historico')
        .select('precio, hora, fecha, cantidad_unidades, maquina_id')
        .in('fecha', chinaDates);
      setVentasHoy(ventas || []);

      // Fetch temp alerts
      let tempAlertCount = 0;
      const tempPromises = maquinas.map(async (m) => {
        try {
          const temp = await fetchTemperatura(m.mac_address);
          if (temp?.temperatura !== undefined && temp.temperatura >= 11) {
            tempAlertCount++;
          }
        } catch { /* skip */ }
      });
      await Promise.allSettled(tempPromises);
      setTempAlerts(tempAlertCount);
    } catch (error) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter sales to only those whose Spain date matches today
  const metrics = useMemo(() => {
    const filtered = ventasHoy.filter(v => {
      const converted = convertChinaToSpainFull(v.hora, v.fecha);
      return converted.fecha === todayStr;
    });

    const totalSales = filtered.reduce((s, v) => s + Number(v.precio), 0);
    const totalIceCreams = filtered.reduce((s, v) => s + (v.cantidad_unidades || 1), 0);

    return {
      totalSalesToday: totalSales,
      totalIceCreamsToday: totalIceCreams,
      activeMachines: machines.filter(m => m.activa).length,
      totalMachines: machines.length,
      lowStockAlerts,
      tempAlerts,
    };
  }, [ventasHoy, todayStr, machines, lowStockAlerts, tempAlerts]);

  if (loading) {
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
                <p className="text-sm text-muted-foreground">Helados Vendidos</p>
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