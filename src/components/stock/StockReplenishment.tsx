import { useEffect, useMemo, useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StockBar } from '@/components/dashboard/StockBar';
import { toast } from '@/hooks/use-toast';
import { useStockConfig } from '@/hooks/useStockConfig';
import { fetchProductos } from '@/services/controlApi';
import { ToppingsResponse } from '@/types';
import { Package, RefreshCw, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

type StockConfigReturn = ReturnType<typeof useStockConfig>;

interface StockReplenishmentProps {
  imei: string;
  stock: ToppingsResponse | undefined;
  stockConfig?: StockConfigReturn;
}

export const StockReplenishment = ({ imei, stock, stockConfig: externalConfig }: StockReplenishmentProps) => {
  const [selectedToppings, setSelectedToppings] = useState<Set<string>>(new Set());
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const queryClient = useQueryClient();

  const internalConfig = useStockConfig(externalConfig ? undefined : imei);
  const { items: stockConfigItems, initializeStock, refillTopping } = externalConfig || internalConfig;


  // Fetch products to include Position 1 (Açaí) which may not be in toppings API
  const { data: productosData } = useQuery({
    queryKey: ['productos-stock', imei],
    queryFn: () => fetchProductos(imei),
    enabled: !!imei,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    // Use productos (fetchProductos) as source of truth for positions
    // Products have real machine positions (1, 2, 3, etc.)
    if (productosData?.productos && productosData.productos.length > 0) {
      const toppings = productosData.productos.map((p) => ({
        posicion: String(p.position),
        nombre: p.goodsName,
      }));
      initializeStock(toppings);
    }
  }, [productosData?.productos]);

  const mergedToppings = useMemo(() => {
    // Use productos as source of truth for positions and names
    const productos = productosData?.productos || [];
    if (productos.length === 0) return [];

    const stockConfigMap = new Map(stockConfigItems.map((item) => [item.topping_position, item]));

    return productos.map((prod) => {
      const posStr = String(prod.position);
      const config = stockConfigMap.get(posStr);
      return {
        posicion: posStr,
        nombre: prod.goodsName,
        // Nunca usar prod.stock (stock físico de la máquina): el sistema es autónomo
        stock_actual: config?.unidades_actuales ?? 0,
        capacidad_maxima: config?.capacidad_maxima ?? 100,
      };
    });
  }, [productosData?.productos, stockConfigItems]);

  const handleToggleTopping = (posicion: string, selected: boolean) => {
    setSelectedToppings((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(posicion);
      } else {
        newSet.delete(posicion);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (mergedToppings.length) {
      setSelectedToppings(new Set(mergedToppings.map((t) => t.posicion)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedToppings(new Set());
  };

  const handleUpdateStock = async () => {
    if (selectedToppings.size === 0) {
      toast({
        title: 'Selecciona toppings',
        description: 'Debes seleccionar al menos un topping para reponer',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdating(true);
    try {
      for (const position of Array.from(selectedToppings)) {
        await refillTopping(position);
      }

      toast({
        title: '✅ Stock repuesto',
        description: `Se han repuesto ${selectedToppings.size} topping(s) en el sistema`,
      });

      setSelectedToppings(new Set());
      setSelectionMode(false);

      queryClient.invalidateQueries({ queryKey: ['toppings', imei] });
      queryClient.invalidateQueries({ queryKey: ['stock-config', imei] });
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message || 'No se pudo actualizar el stock',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };


  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedToppings(new Set());
    }
    setSelectionMode(!selectionMode);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Inventario de Toppings
          </CardTitle>
          {stock?.total_toppings !== undefined && (
            <Badge variant="secondary">{stock.total_toppings} toppings</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {mergedToppings.length > 0 ? (
          <>
            {mergedToppings.map((topping) => (
              <StockBar
                key={topping.posicion}
                nombre={topping.nombre}
                posicion={topping.posicion}
                stockActual={topping.stock_actual}
                capacidadMaxima={topping.capacidad_maxima}
                selectable={selectionMode}
                selected={selectedToppings.has(topping.posicion)}
                onSelect={handleToggleTopping}
              />
            ))}




            <div className="pt-4 border-t space-y-3">
              {selectionMode ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{selectedToppings.size} seleccionado(s)</span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                        Todos
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleDeselectAll}>
                        Ninguno
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={toggleSelectionMode}
                      disabled={isUpdating}
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleUpdateStock}
                      disabled={isUpdating || selectedToppings.size === 0}
                    >
                      {isUpdating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Actualizando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Actualizar Reposición
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <Button variant="outline" className="w-full" onClick={toggleSelectionMode}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar Reposición
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="text-center text-muted-foreground py-8">Sin datos de stock disponibles</p>
        )}
      </CardContent>
    </Card>
  );
};
