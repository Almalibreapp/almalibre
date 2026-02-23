import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Package, AlertTriangle } from 'lucide-react';

interface StockItem {
  id: string;
  machine_imei: string;
  topping_position: string;
  topping_name: string;
  capacidad_maxima: number;
  unidades_actuales: number;
  alerta_minimo: number;
  machineName?: string;
  ownerName?: string;
}

export const AdminStock = () => {
  const { data: stockItems = [], isLoading } = useQuery({
    queryKey: ['admin-stock-all'],
    queryFn: async () => {
      const [{ data: stock }, { data: machines }, { data: profiles }] = await Promise.all([
        supabase.from('stock_config').select('*').order('unidades_actuales', { ascending: true }),
        supabase.from('maquinas').select('mac_address, nombre_personalizado, usuario_id'),
        supabase.from('profiles').select('id, nombre'),
      ]);

      if (!stock) return [];

      const machineMap = new Map(machines?.map((m) => [m.mac_address, m]) || []);
      const profileMap = new Map(profiles?.map((p) => [p.id, p.nombre]) || []);

      return stock.map((s): StockItem => {
        const machine = machineMap.get(s.machine_imei);
        return {
          ...s,
          machineName: machine?.nombre_personalizado || s.machine_imei,
          ownerName: machine ? (profileMap.get(machine.usuario_id) || 'Desconocido') : '',
        };
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  const criticalItems = stockItems.filter((s) => s.unidades_actuales <= s.alerta_minimo);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Package className="h-6 w-6" /> Gestión de Stock
        </h1>
        <p className="text-muted-foreground">{stockItems.length} toppings monitorizados</p>
      </div>

      {criticalItems.length > 0 && (
        <Card className="border-critical/50 bg-critical-light">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-critical">
              <AlertTriangle className="h-4 w-4" />
              Stock Crítico ({criticalItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Máquina</TableHead>
                  <TableHead>Topping</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Franquiciado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {criticalItems.map((s) => {
                  const pct = s.capacidad_maxima > 0 ? (s.unidades_actuales / s.capacidad_maxima) * 100 : 0;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.machineName}</TableCell>
                      <TableCell>{s.topping_name || `Pos. ${s.topping_position}`}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="w-16 h-2" />
                          <span className="text-sm font-medium text-critical">
                            {s.unidades_actuales}/{s.capacidad_maxima}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.ownerName}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {stockItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No hay datos de stock configurados</p>
            <p className="text-sm mt-1">Los registros se crean automáticamente cuando se añaden máquinas</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Todo el Stock</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Máquina</TableHead>
                  <TableHead>Topping</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="hidden sm:table-cell">%</TableHead>
                  <TableHead className="hidden md:table-cell">Franquiciado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockItems.map((s) => {
                  const pct = s.capacidad_maxima > 0 ? (s.unidades_actuales / s.capacidad_maxima) * 100 : 0;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-sm">{s.machineName}</TableCell>
                      <TableCell className="text-sm">{s.topping_name || `Pos. ${s.topping_position}`}</TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">
                          {s.unidades_actuales}/{s.capacidad_maxima}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge
                          variant={pct <= 20 ? 'destructive' : pct <= 50 ? 'default' : 'secondary'}
                          className={pct > 50 ? 'bg-success text-success-foreground' : pct <= 20 ? '' : 'bg-warning text-warning-foreground'}
                        >
                          {pct.toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{s.ownerName}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
