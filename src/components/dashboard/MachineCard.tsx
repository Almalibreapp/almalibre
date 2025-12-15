import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Maquina, StockResponse, TemperaturaResponse, VentasResponse } from '@/types';
import { fetchStock, fetchTemperatura, fetchVentas } from '@/services/api';
import { MapPin, Thermometer, DollarSign, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MachineCardProps {
  maquina: Maquina;
  onClick: () => void;
}

export const MachineCard = ({ maquina, onClick }: MachineCardProps) => {
  const [temperatura, setTemperatura] = useState<TemperaturaResponse | null>(null);
  const [ventas, setVentas] = useState<VentasResponse | null>(null);
  const [stock, setStock] = useState<StockResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [tempData, ventasData, stockData] = await Promise.all([
          fetchTemperatura(maquina.mac_address),
          fetchVentas(maquina.mac_address),
          fetchStock(maquina.mac_address),
        ]);
        setTemperatura(tempData);
        setVentas(ventasData);
        setStock(stockData);
      } catch (error) {
        console.error('Error loading machine data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [maquina.mac_address]);

  const lowStockCount = stock?.toppings.filter(t => (t.stock_actual / t.capacidad_maxima) < 0.2).length || 0;
  const isOnline = maquina.activa;

  const getTempColor = (estado?: string) => {
    switch (estado) {
      case 'normal': return 'text-success';
      case 'alerta': return 'text-warning';
      case 'critico': return 'text-critical';
      default: return 'text-muted-foreground';
    }
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

        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className={cn("flex items-center justify-center gap-1", getTempColor(temperatura?.estado))}>
              <Thermometer className="h-4 w-4" />
              <span className="font-semibold">
                {loading ? '--' : `${temperatura?.temperatura_actual?.toFixed(1)}°C`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Temperatura</p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-primary">
              <DollarSign className="h-4 w-4" />
              <span className="font-semibold">
                {loading ? '--' : `$${ventas?.total_ingresos?.toFixed(2) || '0.00'}`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Hoy</p>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-center">
            {lowStockCount > 0 ? (
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
      </CardContent>
    </Card>
  );
};
