import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Maquina } from '@/types';
import { useMaquinaData, useVentasDetalle } from '@/hooks/useMaquinaData';
import { useVentasRealtime } from '@/hooks/useVentasRealtime';
import { isSuccessfulSale, summarizeSales } from '@/lib/sales';
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
  const ventasList = Array.isArray(ventasDetalle?.ventas) ? ventasDetalle.ventas : [];
  const toppingsList = Array.isArray(stock?.toppings) ? stock.toppings : [];

  // Sales already come pre-normalized to Spain time from useVentasDetalle
  const ventasHoy = useMemo(() => {
    if (ventasList.length === 0) return { euros: 0, cantidad: 0 };
    // ventas already filtered to todaySpain by the hook, just filter successful
    const exitosas = ventasList.filter((v: any) => isSuccessfulSale(v));
    return {
      euros: exitosas.reduce((s: number, v: any) => s + Number(v.precio), 0),
      cantidad: exitosas.length,
    };
  }, [ventasList]);

  const lowStockCount = toppingsList.filter(t => t.capacidad_maxima > 0 && (t.stock_actual / t.capacidad_maxima) <= 0.25).length;
  const isOnline = maquina.activa && !hasError;
  const isTempCritical = temperatura?.temperatura !== undefined && temperatura.temperatura >= 11;

  const getTempColor = () => {
    if (temperatura?.temperatura === undefined) return 'text-muted-foreground';
    if (temperatura.temperatura >= 11) return 'text-critical';
    return 'text-success';
  };

  return (
    <Card
      className="relative cursor-pointer overflow-hidden border-0 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary-glow text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/40 active:scale-[0.98]"
      onClick={onClick}
    >
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-primary-foreground/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-primary-glow/30 blur-2xl" />

      <CardContent className="relative p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg leading-tight truncate">{maquina.nombre_personalizado}</h3>
            {maquina.ubicacion && (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-primary-foreground/70">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{maquina.ubicacion}</span>
              </div>
            )}
          </div>
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-sm flex-shrink-0",
              isOnline ? "bg-primary-foreground/15" : "bg-critical/80"
            )}
          >
            {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {isOnline ? 'En línea' : 'Offline'}
          </span>
        </div>

        {hasError ? (
          <div className="flex items-center gap-2 rounded-xl bg-primary-foreground/10 p-3 text-sm backdrop-blur-sm">
            <AlertCircle className="h-4 w-4" />
            <span>Sin datos disponibles</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-primary-foreground/10 p-3 text-center backdrop-blur-sm">
              <div className="flex items-center justify-center gap-1">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Thermometer className={cn("h-4 w-4", isTempCritical && "text-critical")} />
                    <span className="font-bold text-sm sm:text-base">
                      {temperatura?.temperatura !== undefined ? `${temperatura.temperatura}°` : '--°'}
                    </span>
                  </>
                )}
              </div>
              <p className="mt-1 text-[11px] text-primary-foreground/60">Temperatura</p>
            </div>

            <div className="rounded-xl bg-primary-foreground/10 p-3 text-center backdrop-blur-sm">
              <div className="flex items-center justify-center gap-1">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="font-bold text-sm sm:text-base">{ventasHoy.euros.toFixed(2)} €</span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-primary-foreground/60">Hoy</p>
            </div>

            <div className="rounded-xl bg-primary-foreground/10 p-3 text-center backdrop-blur-sm">
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : lowStockCount > 0 ? (
                <div className="flex items-center justify-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-bold text-sm sm:text-base">{lowStockCount}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1">
                  <span className="font-bold text-sm sm:text-base">OK</span>
                </div>
              )}
              <p className="mt-1 text-[11px] text-primary-foreground/60">Stock</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
