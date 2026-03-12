import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { fetchVentasDetalle } from '@/services/api';
import { actualizarStockConSync } from '@/services/controlApi';
import { Venta } from '@/types';

/**
 * Polls ventas-detalle every 30s, detects new sales, deducts from stock_config,
 * and syncs each position with the physical machine.
 */
export const useStockSync = (imei: string | undefined) => {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSyncRef = useRef<string | null>(null);
  const isRunningRef = useRef(false);

  const syncStock = useCallback(async () => {
    if (!imei || !user || isRunningRef.current) return;
    isRunningRef.current = true;

    try {
      const { data: syncLog } = await supabase
        .from('stock_sync_log')
        .select('*')
        .eq('machine_imei', imei)
        .maybeSingle();

      const lastSync = syncLog?.ultima_sincronizacion || new Date(0).toISOString();
      lastSyncRef.current = lastSync;

      const ventasData = await fetchVentasDetalle(imei);
      const ventas: Venta[] = ventasData?.ventas || [];

      if (ventas.length === 0) {
        isRunningRef.current = false;
        return;
      }

      const lastSaleId = syncLog?.ultima_venta_id;
      let newVentas: Venta[];

      if (lastSaleId) {
        const lastIdx = ventas.findIndex((v) => v.id === lastSaleId);
        newVentas = lastIdx > 0 ? ventas.slice(0, lastIdx) : (lastIdx === -1 ? ventas : []);
        console.log(`[StockSync] lastSaleId=${lastSaleId}, lastIdx=${lastIdx}, newVentas=${newVentas.length}`);
      } else {
        newVentas = [];
      }

      for (const venta of newVentas) {
        if (venta.estado && venta.estado !== 'exitoso') {
          console.log('[StockSync] Skipping non-exitoso sale:', venta.id, venta.estado);
          continue;
        }

        // Collect ALL positions to deduct (using stock_config format)
        const positionsToDeduct = new Map<string, number>();
        positionsToDeduct.set('1', 1); // Always deduct Açaí

        if (venta.toppings && Array.isArray(venta.toppings) && venta.toppings.length > 0) {
          for (const topping of venta.toppings) {
            const pos = topping.posicion?.toString();
            if (!pos) continue;
            const qty = parseInt(topping.cantidad) || 1;
            positionsToDeduct.set(pos, (positionsToDeduct.get(pos) || 0) + qty);
          }
        }

        console.log(`[StockSync] Sale ${venta.id}: deducting positions:`, Object.fromEntries(positionsToDeduct));

        // Deduct each position in Supabase AND sync with physical machine
        for (const [position, qty] of positionsToDeduct) {
          const { data: current } = await supabase
            .from('stock_config')
            .select('unidades_actuales')
            .eq('machine_imei', imei)
            .eq('topping_position', position)
            .maybeSingle();

          if (current && current.unidades_actuales > 0) {
            const newQty = Math.max(0, current.unidades_actuales - qty);
            await supabase
              .from('stock_config')
              .update({ unidades_actuales: newQty })
              .eq('machine_imei', imei)
              .eq('topping_position', position);
            console.log(`[StockSync] ✅ Position ${position}: ${current.unidades_actuales} → ${newQty}`);

            // Position is already a pure numeric string — no conversion needed
            console.log(`[StockSync] 🔄 Syncing position ${position} qty=${newQty} with machine...`);
            try {
              const syncResult = await actualizarStockConSync(imei, position, newQty);
              if (syncResult.success && syncResult.sync_status === 'success') {
                console.log(`[StockSync] ✅ Position ${position} synced with machine`);
              } else {
                console.warn(`[StockSync] ⚠️ Position ${position} sync: ${syncResult.sync_status} - ${syncResult.message || ''}`);
              }
            } catch (syncErr) {
              console.error(`[StockSync] ❌ Position ${position} sync error:`, syncErr);
            }
          } else if (!current) {
            console.log(`[StockSync] ⚠️ Position ${position} not found in stock_config for IMEI ${imei}`);
          }
        }
      }

      const latestSaleId = ventas[0]?.id || lastSaleId;
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
    syncStock();
    intervalRef.current = setInterval(syncStock, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [imei, user, syncStock]);
};
