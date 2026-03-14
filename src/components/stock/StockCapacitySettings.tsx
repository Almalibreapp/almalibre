import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useStockConfig } from '@/hooks/useStockConfig';
import { fetchProductos } from '@/services/controlApi';
import { ToppingsResponse } from '@/types';
import { Loader2, Save } from 'lucide-react';

type StockConfigReturn = ReturnType<typeof useStockConfig>;

interface StockCapacitySettingsProps {
  imei: string;
  stock: ToppingsResponse | undefined;
  stockConfig?: StockConfigReturn;
}

export const StockCapacitySettings = ({ imei, stock, stockConfig: externalConfig }: StockCapacitySettingsProps) => {
  const internalConfig = useStockConfig(externalConfig ? undefined : imei);
  const { items, loading, initializeStock, updateToppingCapacity } = externalConfig || internalConfig;

  const [draftCapacities, setDraftCapacities] = useState<Record<string, string>>({});
  const [savingPosition, setSavingPosition] = useState<string | null>(null);

  // Fetch products from manufacturer as single source of truth
  const { data: productosData } = useQuery({
    queryKey: ['productos-stock', imei],
    queryFn: () => fetchProductos(imei),
    enabled: !!imei,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (productosData?.productos && productosData.productos.length > 0) {
      const toppings = productosData.productos.map((p) => ({
        posicion: String(p.position),
        nombre: p.goodsName,
      }));
      initializeStock(toppings);
    }
  }, [productosData?.productos]);

  // Merge manufacturer products with stock config (manufacturer = source of truth for positions)
  const mergedItems = useMemo(() => {
    const productos = productosData?.productos || [];
    if (productos.length === 0) return items; // fallback to DB items if no manufacturer data

    const stockConfigMap = new Map(items.map((item) => [item.topping_position, item]));

    return productos.map((prod) => {
      const posStr = String(prod.position);
      const config = stockConfigMap.get(posStr);
      return {
        id: config?.id || posStr,
        topping_position: posStr,
        topping_name: prod.goodsName || config?.topping_name || `Posición ${posStr}`,
        capacidad_maxima: config?.capacidad_maxima ?? 100,
        unidades_actuales: config?.unidades_actuales ?? 0,
        machine_imei: imei,
        alerta_minimo: config?.alerta_minimo ?? 20,
        user_id: config?.user_id || '',
      };
    });
  }, [productosData?.productos, items, imei]);

  useEffect(() => {
    const initialDrafts: Record<string, string> = {};
    mergedItems.forEach((item) => {
      initialDrafts[item.topping_position] = String(item.capacidad_maxima);
    });
    setDraftCapacities(initialDrafts);
  }, [mergedItems]);

  const handleSave = async (position: string) => {
    const nextValue = Number(draftCapacities[position]);
    if (!Number.isFinite(nextValue) || nextValue <= 0) return;

    setSavingPosition(position);
    await updateToppingCapacity(position, nextValue);
    setSavingPosition(null);
  };

  if (loading && mergedItems.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Capacidad máxima por topping</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {mergedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay toppings configurados todavía.</p>
        ) : (
          mergedItems.map((item) => (
            <div key={item.topping_position} className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px_110px] gap-3 items-end border-b pb-3 last:border-0">
              <div>
                <Label className="text-sm">{item.topping_name || `Posición ${item.topping_position}`}</Label>
                <p className="text-xs text-muted-foreground">
                  Actual: {item.unidades_actuales}/{item.capacidad_maxima}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Nuevo máximo</Label>
                <Input
                  type="number"
                  min="1"
                  value={draftCapacities[item.topping_position] ?? ''}
                  onChange={(e) =>
                    setDraftCapacities((prev) => ({ ...prev, [item.topping_position]: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Posición</Label>
                <Input value={item.topping_position} disabled />
              </div>
              <Button
                onClick={() => handleSave(item.topping_position)}
                disabled={savingPosition === item.topping_position}
                variant="outline"
              >
                {savingPosition === item.topping_position ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar
                  </>
                )}
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
