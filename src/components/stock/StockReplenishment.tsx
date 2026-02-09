import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StockBar } from '@/components/dashboard/StockBar';
import { toast } from '@/hooks/use-toast';
import { actualizarStockTopping } from '@/services/controlApi';
import { ToppingsResponse } from '@/types';
import { Package, RefreshCw, Loader2, CheckCircle } from 'lucide-react';

interface StockReplenishmentProps {
  imei: string;
  stock: ToppingsResponse | undefined;
}

export const StockReplenishment = ({ imei, stock }: StockReplenishmentProps) => {
  const [selectedToppings, setSelectedToppings] = useState<Set<string>>(new Set());
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const queryClient = useQueryClient();

  const handleToggleTopping = (posicion: string, selected: boolean) => {
    setSelectedToppings(prev => {
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
    if (stock?.toppings) {
      setSelectedToppings(new Set(stock.toppings.map(t => t.posicion)));
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
        variant: 'destructive'
      });
      return;
    }

    setIsUpdating(true);
    try {
      await actualizarStockTopping(imei, Array.from(selectedToppings));
      
      toast({
        title: '✅ Stock actualizado',
        description: `Se han repuesto ${selectedToppings.size} topping(s) al 100%`,
      });
      
      // Limpiar selección y salir del modo selección
      setSelectedToppings(new Set());
      setSelectionMode(false);
      
      // Invalidar caché para refrescar datos
      queryClient.invalidateQueries({ queryKey: ['toppings', imei] });
      
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message || 'No se pudo actualizar el stock',
        variant: 'destructive'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleSelectionMode = () => {
    if (selectionMode) {
      // Salir del modo selección
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
        {stock?.toppings && stock.toppings.length > 0 ? (
          <>
            {stock.toppings.map((topping) => (
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
            
            {/* Acciones de reposición */}
            <div className="pt-4 border-t space-y-3">
              {selectionMode ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {selectedToppings.size} seleccionado(s)
                    </span>
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
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={toggleSelectionMode}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar Reposición
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Sin datos de stock disponibles
          </p>
        )}
      </CardContent>
    </Card>
  );
};
