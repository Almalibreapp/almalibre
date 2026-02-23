import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useStockConfig } from '@/hooks/useStockConfig';
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

  useEffect(() => {
    if (stock?.toppings?.length) {
      initializeStock(stock.toppings.map((t) => ({ posicion: t.posicion, nombre: t.nombre })));
    }
  }, [stock?.toppings]);

  useEffect(() => {
    const initialDrafts: Record<string, string> = {};
    items.forEach((item) => {
      initialDrafts[item.topping_position] = String(item.capacidad_maxima);
    });
    setDraftCapacities(initialDrafts);
  }, [items]);

  const stockByPosition = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((item) => map.set(item.topping_position, item.unidades_actuales));
    return map;
  }, [items]);

  const handleSave = async (position: string) => {
    const nextValue = Number(draftCapacities[position]);
    if (!Number.isFinite(nextValue) || nextValue <= 0) return;

    setSavingPosition(position);
    await updateToppingCapacity(position, nextValue);
    setSavingPosition(null);
  };

  if (loading && items.length === 0) {
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
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay toppings configurados todavía.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px_110px] gap-3 items-end border-b pb-3 last:border-0">
              <div>
                <Label className="text-sm">{item.topping_name || `Posición ${item.topping_position}`}</Label>
                <p className="text-xs text-muted-foreground">
                  Actual: {stockByPosition.get(item.topping_position) ?? item.unidades_actuales}/{item.capacidad_maxima}
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
