import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { fetchVentasDetalle } from '@/services/api';
import { Venta } from '@/types';

/**
 * Polls ventas-detalle every 30s, detects new sales, and deducts from stock_config.
 * Only runs when the machine view is active (component mounted).
 */
export const useStockSync = (imei: string | undefined) => {
  const { user } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<string | null>(null);
  const isRunningRef = useRef(false);

  const syncStock = useCallback(async () => {
    if (!imei || !user || isRunningRef.current) return;
    isRunningRef.current = true;

    try {
      // Get last sync timestamp
      const { data: syncLog } = await supabase
        .from('stock_sync_log')
        .select('*')
        .eq('machine_imei', imei)
        .maybeSingle();

      const lastSync = syncLog?.ultima_sincronizacion || new Date(0).toISOString();
      lastSyncRef.current = lastSync;

      // Fetch today's sales
      const ventasData = await fetchVentasDetalle(imei);
      const ventas: Venta[] = ventasData?.ventas || [];

      if (ventas.length === 0) {
        isRunningRef.current = false;
        return;
      }

      // Find new sales (by comparing IDs or using last known sale ID)
      const lastSaleId = syncLog?.ultima_venta_id;
      let newVentas: Venta[];

      if (lastSaleId) {
        const lastIdx = ventas.findIndex((v) => v.id === lastSaleId);
        newVentas = lastIdx >= 0 ? ventas.slice(lastIdx + 1) : [];
      } else {
        // First sync - don't deduct, just mark current position
        newVentas = [];
      }

      // Deduct toppings from new sales
      for (const venta of newVentas) {
        if (venta.toppings && venta.toppings.length > 0) {
          for (const topping of venta.toppings) {
            const qty = parseInt(topping.cantidad) || 1;
            // Decrement stock_config
            const { data: current } = await supabase
              .from('stock_config')
              .select('unidades_actuales')
              .eq('machine_imei', imei)
              .eq('topping_position', topping.posicion)
              .maybeSingle();

            if (current) {
              const newQty = Math.max(0, current.unidades_actuales - qty);
              await supabase
                .from('stock_config')
                .update({ unidades_actuales: newQty })
                .eq('machine_imei', imei)
                .eq('topping_position', topping.posicion);
            }
          }
        }
      }

      // Update sync log
      const latestSaleId = ventas[ventas.length - 1]?.id || lastSaleId;
      await supabase
        .from('stock_sync_log')
        .upsert(
          {
            machine_imei: imei,
            ultima_sincronizacion: new Date().toISOString(),
            ultima_venta_id: latestSaleId,
            user_id: user.id,
          },
          { onConflict: 'machine_imei' }
        );
    } catch (error) {
      console.error('Stock sync error:', error);
    } finally {
      isRunningRef.current = false;
    }
  }, [imei, user]);

  useEffect(() => {
    if (!imei || !user) return;

    // Initial sync
    syncStock();

    // Poll every 30 seconds
    intervalRef.current = setInterval(syncStock, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [imei, user, syncStock]);
};
