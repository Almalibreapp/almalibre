import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { fetchVentasResumen } from '@/services/api';
import { Loader2, Euro, TrendingUp, Calendar } from 'lucide-react';

interface MachineSales {
  imei: string;
  name: string;
  todayEuros: number;
  todayCount: number;
  yesterdayEuros: number;
  monthEuros: number;
  monthCount: number;
}

export const AdminSales = () => {
  const [sales, setSales] = useState<MachineSales[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    try {
      const { data: machines } = await supabase.from('maquinas').select('mac_address, nombre_personalizado');
      if (!machines) return;

      const results: MachineSales[] = [];
      const promises = machines.map(async (m) => {
        try {
          const v = await fetchVentasResumen(m.mac_address);
          results.push({
            imei: m.mac_address,
            name: m.nombre_personalizado,
            todayEuros: v?.ventas_hoy?.total_euros || 0,
            todayCount: v?.ventas_hoy?.cantidad || 0,
            yesterdayEuros: v?.ventas_ayer?.total_euros || 0,
            monthEuros: v?.ventas_mes?.total_euros || 0,
            monthCount: v?.ventas_mes?.cantidad || 0,
          });
        } catch { /* skip */ }
      });
      await Promise.allSettled(promises);
      results.sort((a, b) => b.todayEuros - a.todayEuros);
      setSales(results);
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const totals = sales.reduce(
    (acc, s) => ({
      todayEuros: acc.todayEuros + s.todayEuros,
      todayCount: acc.todayCount + s.todayCount,
      yesterdayEuros: acc.yesterdayEuros + s.yesterdayEuros,
      monthEuros: acc.monthEuros + s.monthEuros,
      monthCount: acc.monthCount + s.monthCount,
    }),
    { todayEuros: 0, todayCount: 0, yesterdayEuros: 0, monthEuros: 0, monthCount: 0 }
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Euro className="h-6 w-6" /> Ventas Globales
        </h1>
        <p className="text-muted-foreground">Resumen de ventas de toda la red</p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Hoy</p>
            <p className="text-3xl font-bold text-primary">{totals.todayEuros.toFixed(2)}€</p>
            <p className="text-xs text-muted-foreground">{totals.todayCount} ventas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Ayer</p>
            <p className="text-3xl font-bold">{totals.yesterdayEuros.toFixed(2)}€</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendingUp className={cn_trend(totals.todayEuros, totals.yesterdayEuros)} />
              <span className={`text-xs ${cn_trend(totals.todayEuros, totals.yesterdayEuros)}`}>
                {totals.yesterdayEuros > 0
                  ? `${(((totals.todayEuros - totals.yesterdayEuros) / totals.yesterdayEuros) * 100).toFixed(0)}%`
                  : '--'}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Este Mes</p>
            <p className="text-3xl font-bold">{totals.monthEuros.toFixed(2)}€</p>
            <p className="text-xs text-muted-foreground">{totals.monthCount} ventas</p>
          </CardContent>
        </Card>
      </div>

      {/* Per machine */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking por Máquina (Hoy)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sales.map((s, i) => (
            <div key={s.imei} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{s.imei}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary">{s.todayEuros.toFixed(2)}€</p>
                <p className="text-xs text-muted-foreground">{s.todayCount} ventas</p>
              </div>
            </div>
          ))}
          {sales.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Sin datos de ventas</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

function cn_trend(today: number, yesterday: number): string {
  if (today >= yesterday) return 'text-success h-3 w-3';
  return 'text-critical h-3 w-3';
}
