import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Maquina } from '@/types';
import { useMaquinaData, useVentasDetalle } from '@/hooks/useMaquinaData';
import { useVentasRealtime } from '@/hooks/useVentasRealtime';
import { convertChinaToSpainFull } from '@/lib/timezone';
import { MapPin, Thermometer, AlertTriangle, Wifi, WifiOff, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MachineCardProps {
  maquina: Maquina;
  onClick: () => void;
}

export const MachineCard = ({ maquina, onClick }: MachineCardProps) => {
  const imei = maquina.mac_address;
  const { temperatura, stock, isLoading, hasError } = useMaquinaData(imei);
  const { data: ventasDetalle } = useVentasDetalle(imei);
  useVentasRealtime(imei);

  const todaySpain = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });

  // Use API data directly for today's sales (same source as detail view)
  const ventasHoy = useMemo(() => {
    if (!ventasDetalle?.ventas) return { euros: 0, cantidad: 0 };
    const exitosas = ventasDetalle.ventas
      .filter((v: any) => {
        const converted = convertChinaToSpainFull(v.hora, ventasDetalle.fecha);
        return converted.fecha === todaySpain && v.estado === 'exitoso';
      });
    return {
      euros: exitosas.reduce((s: number, v: any) => s + Number(v.precio), 0),
      cantidad: exitosas.length,
    };
  }, [ventasDetalle, todaySpain]);

  const lowStockCount = stock?.toppings?.filter(t => t.capacidad_maxima > 0 && (t.stock_actual / t.capacidad_maxima) <= 0.25).length || 0;
  const isOnline = maquina.activa && !hasError;
  const isTempCritical = temperatura?.temperatura !== undefined && temperatura.temperatura >= 11;

  const getTempColor = () => {
    if (temperatura?.temperatura === undefined) return 'text-muted-foreground';
    if (temperatura.temperatura >= 11) return 'text-critical';
    return 'text-success';
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-soft hover:border-primary/30 transition-all duration-200 active:scale-[0.98]"
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg truncate">{maquina.nombre_personalizado}</h3>
              {isOnline ? (
                <Wifi className="h-4 w-4 text-success flex-shrink-0" />
              ) : (
                <WifiOff className="h-4 w-4 text-critical flex-shrink-0" />
              )}
            </div>
            {maquina.ubicacion && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span className="truncate">{maquina.ubicacion}</span>
              </div>
            )}
          </div>
        </div>

        {hasError ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4 p-3 bg-muted/50 rounded-lg">
            <AlertCircle className="h-4 w-4 text-warning" />
            <span>Sin datos disponibles</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className={cn("flex items-center justify-center gap-1", getTempColor())}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Thermometer className="h-4 w-4" />
                    <span className="font-semibold">
                      {temperatura?.temperatura !== undefined ? `${temperatura.temperatura}°${temperatura.unidad || 'C'}` : '--°C'}
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Temperatura</p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-primary">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="font-semibold">
                    {ventasHoy.euros.toFixed(2)} €
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Hoy</p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-center">
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : lowStockCount > 0 ? (
                <div className="flex items-center justify-center gap-1 text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-semibold">{lowStockCount}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1 text-success">
                  <span className="font-semibold">OK</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Stock</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
