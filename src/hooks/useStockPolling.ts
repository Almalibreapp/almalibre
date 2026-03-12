import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchProductos } from '@/services/controlApi';

/**
 * Hook que consulta el stock REAL de la máquina cada X minutos
 * y actualiza stock_config en Supabase para reflejar el estado real.
 * NO toca la reposición ni la sincronización.
 */
export function useStockPolling(
  imei: string | undefined,
  intervalMinutos: number = 2
) {
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const [polling, setPolling] = useState(false);
  const isRunningRef = useRef(false);
  const refreshCounterRef = useRef(0);

  const consultarStockReal = useCallback(async () => {
    if (!imei || isRunningRef.current) return;
    isRunningRef.current = true;
    setPolling(true);

    try {
      console.log('\n📡 [StockPolling] Consultando stock de la máquina...');

      const { success, productos } = await fetchProductos(imei);

      if (!success || !productos?.length) {
        console.warn('[StockPolling] No se obtuvieron productos');
        return;
      }

      console.log(`📦 [StockPolling] Productos obtenidos: ${productos.length}`);

      for (const producto of productos) {
        const position = String(producto.position);
        const stockMaquina = producto.stock;
        const nombre = producto.goodsName || `Position ${position}`;

        // Read current value from Supabase
        const { data: existing } = await supabase
          .from('stock_config')
          .select('unidades_actuales, topping_name')
          .eq('machine_imei', imei)
          .eq('topping_position', position)
          .maybeSingle();

        if (existing) {
          // Only update if different to avoid unnecessary writes
          if (existing.unidades_actuales !== stockMaquina) {
            await supabase
              .from('stock_config')
              .update({ unidades_actuales: stockMaquina })
              .eq('machine_imei', imei)
              .eq('topping_position', position);

            console.log(
              `  Position ${position} (${nombre}): ${existing.unidades_actuales} → ${stockMaquina}`
            );
          } else {
            console.log(
              `  Position ${position} (${nombre}): ${stockMaquina} (sin cambios)`
            );
          }
        } else {
          console.log(
            `  Position ${position} (${nombre}): ${stockMaquina} (no config en DB, ignorado)`
          );
        }
      }

      setUltimaActualizacion(new Date());
      console.log('✅ [StockPolling] Stock actualizado');
    } catch (error) {
      console.error('❌ [StockPolling] Error consultando stock:', error);
    } finally {
      isRunningRef.current = false;
      setPolling(false);
    }
  }, [imei]);

  // Manual refresh
  const refrescarAhora = useCallback(() => {
    refreshCounterRef.current += 1;
    consultarStockReal();
  }, [consultarStockReal]);

  useEffect(() => {
    if (!imei) return;

    console.log(`🔄 [StockPolling] Iniciando consulta periódica (cada ${intervalMinutos} min)`);

    // Execute immediately
    consultarStockReal();

    // Then every X minutes
    const interval = setInterval(consultarStockReal, intervalMinutos * 60 * 1000);

    return () => {
      console.log('🔴 [StockPolling] Deteniendo consulta periódica');
      clearInterval(interval);
    };
  }, [imei, intervalMinutos, consultarStockReal]);

  return { ultimaActualizacion, polling, refrescarAhora };
}
