import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface StockConfigItem {
  id: string;
  machine_imei: string;
  topping_position: string;
  topping_name: string;
  capacidad_maxima: number;
  unidades_actuales: number;
  alerta_minimo: number;
  user_id: string;
}

export const useStockConfig = (imei: string | undefined) => {
  const { user } = useAuth();
  const [items, setItems] = useState<StockConfigItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStock = useCallback(async () => {
    if (!imei) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('stock_config')
      .select('*')
      .eq('machine_imei', imei)
      .order('topping_position');

    if (error) {
      console.error('Error fetching stock config:', error);
    } else {
      setItems((data || []) as StockConfigItem[]);
    }
    setLoading(false);
  }, [imei]);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  const initializeStock = async (toppings: { posicion: string; nombre: string }[]) => {
    if (!imei || !user) return;

    const records = toppings.map((t) => ({
      machine_imei: imei,
      topping_position: t.posicion,
      topping_name: t.nombre,
      capacidad_maxima: 100,
      unidades_actuales: 100,
      alerta_minimo: 20,
      user_id: user.id,
    }));

    const { error } = await supabase
      .from('stock_config')
      .upsert(records, { onConflict: 'machine_imei,topping_position' });

    if (error) {
      console.error('Error initializing stock:', error);
    } else {
      await fetchStock();
    }
  };

  const refillTopping = async (position: string) => {
    if (!imei || !user) return;

    const item = items.find((i) => i.topping_position === position);
    if (!item) return;

    // Log history
    await supabase.from('stock_history').insert({
      machine_imei: imei,
      topping_position: position,
      topping_name: item.topping_name,
      unidades_anteriores: item.unidades_actuales,
      unidades_nuevas: item.capacidad_maxima,
      accion: 'rellenar',
      user_id: user.id,
    });

    // Update stock
    const { error } = await supabase
      .from('stock_config')
      .update({ unidades_actuales: item.capacidad_maxima })
      .eq('machine_imei', imei)
      .eq('topping_position', position);

    if (error) {
      toast({ title: 'Error', description: 'No se pudo rellenar el stock', variant: 'destructive' });
    } else {
      toast({ title: `✅ ${item.topping_name} rellenado`, description: `Rellenado a ${item.capacidad_maxima} unidades` });
      await fetchStock();
    }
  };

  const updateToppingCapacity = async (position: string, nuevaCapacidad: number) => {
    if (!imei || !user) return;

    const capacidad = Math.max(1, Math.round(nuevaCapacidad));
    const item = items.find((i) => i.topping_position === position);

    const { error } = await supabase
      .from('stock_config')
      .update({
        capacidad_maxima: capacidad,
        unidades_actuales: item ? Math.min(item.unidades_actuales, capacidad) : capacidad,
      })
      .eq('machine_imei', imei)
      .eq('topping_position', position);

    if (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar la capacidad máxima', variant: 'destructive' });
      return;
    }

    toast({ title: 'Capacidad actualizada', description: `Nuevo máximo: ${capacidad} unidades` });
    await fetchStock();
  };

  return {
    items,
    loading,
    refillTopping,
    initializeStock,
    updateToppingCapacity,
    refetch: fetchStock,
  };
};
