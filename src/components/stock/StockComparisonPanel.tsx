import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStockPolling } from '@/hooks/useStockPolling';
import { useStockConfig } from '@/hooks/useStockConfig';
import { RefreshCw, Loader2, Server, HardDrive, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface StockComparisonPanelProps {
  imei: string;
}

/**
 * Panel exclusivo del admin: muestra en paralelo
 *  - "Sistema": stock que gestiona la app (fuente de verdad para operar).
 *  - "Máquina (API)": stock que reporta la máquina física.
 *
 * Solo es informativo. NO modifica ninguna de las dos.
 */
export const StockComparisonPanel = ({ imei }: StockComparisonPanelProps) => {
  const { productosApi, polling, ultimaActualizacion, refrescarAhora, error } =
    useStockPolling(imei, 2);
  const { items: sistemaItems } = useStockConfig(imei);

  const rows = useMemo(() => {
    const sysMap = new Map(sistemaItems.map((s) => [s.topping_position, s]));
    const apiMap = new Map(productosApi.map((p) => [String(p.position), p]));
    const positions = new Set<string>([
      ...sistemaItems.map((s) => s.topping_position),
      ...productosApi.map((p) => String(p.position)),
    ]);
    return Array.from(positions)
      .sort((a, b) => Number(a) - Number(b))
      .map((pos) => {
        const sys = sysMap.get(pos);
        const api = apiMap.get(pos);
        const sysUnits = sys?.unidades_actuales ?? null;
        const apiUnits = api?.stock ?? null;
        const diff =
          sysUnits != null && apiUnits != null ? sysUnits - apiUnits : null;
        return {
          position: pos,
          nombre: sys?.topping_name || api?.goodsName || `Pos. ${pos}`,
          sysUnits,
          sysMax: sys?.capacidad_maxima ?? null,
          apiUnits,
          diff,
        };
      });
  }, [sistemaItems, productosApi]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" />
            Sistema vs. Máquina (API)
          </CardTitle>
          <div className="flex items-center gap-2">
            {ultimaActualizacion && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {ultimaActualizacion.toLocaleTimeString('es-ES')}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={refrescarAhora}
              disabled={polling}
              className="h-8"
            >
              {polling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Informativo. El sistema opera de forma autónoma; la columna "Máquina"
          es solo lectura.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {error && (
          <div className="mx-4 mb-3 flex items-center gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning">
            <AlertTriangle className="h-3 w-3" />
            No se pudo leer la API: {error}
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-center">
                <span className="inline-flex items-center gap-1">
                  <Server className="h-3 w-3" /> Sistema
                </span>
              </TableHead>
              <TableHead className="text-center">
                <span className="inline-flex items-center gap-1">
                  <HardDrive className="h-3 w-3" /> Máquina
                </span>
              </TableHead>
              <TableHead className="text-center hidden sm:table-cell">Diferencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                  Sin datos disponibles
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const match = r.diff === 0;
                const missing = r.sysUnits == null || r.apiUnits == null;
                return (
                  <TableRow key={r.position}>
                    <TableCell className="text-xs text-muted-foreground">{r.position}</TableCell>
                    <TableCell className="text-sm font-medium">{r.nombre}</TableCell>
                    <TableCell className="text-center text-sm">
                      {r.sysUnits != null ? (
                        <span>
                          {r.sysUnits}
                          {r.sysMax != null && (
                            <span className="text-muted-foreground">/{r.sysMax}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {r.apiUnits != null ? r.apiUnits : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell">
                      {missing ? (
                        <Badge variant="secondary">n/d</Badge>
                      ) : match ? (
                        <Badge className="bg-success text-success-foreground">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-warning text-warning">
                          {r.diff! > 0 ? `+${r.diff}` : r.diff}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
