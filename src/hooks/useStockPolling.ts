import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchProductos, type Producto } from '@/services/controlApi';

/**
 * Consulta el stock REAL de la máquina (API del fabricante) SOLO para lectura
 * y comparación en el panel admin. NO escribe en Supabase.
 *
 * El stock del sistema (stock_config) es la fuente de verdad para la operación
 * y se gestiona de forma autónoma: reposición manual + desconteo por trigger
 * en ventas_historico.
 */
export function useStockPolling(
  imei: string | undefined,
  intervalMinutos: number = 2
) {
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const [polling, setPolling] = useState(false);
  const [productosApi, setProductosApi] = useState<Producto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const isRunningRef = useRef(false);

  const consultarStockReal = useCallback(async () => {
    if (!imei || isRunningRef.current) return;
    isRunningRef.current = true;
    setPolling(true);
    setError(null);

    try {
      const { success, productos } = await fetchProductos(imei);
      if (!success || !productos?.length) {
        setError('La API no devolvió productos');
        return;
      }
      setProductosApi(productos);
      setUltimaActualizacion(new Date());
    } catch (err) {
      console.error('[StockPolling] Error consultando API:', err);
      setError((err as Error).message || 'Error consultando la máquina');
    } finally {
      isRunningRef.current = false;
      setPolling(false);
    }
  }, [imei]);

  const refrescarAhora = useCallback(() => {
    consultarStockReal();
  }, [consultarStockReal]);

  useEffect(() => {
    if (!imei) return;
    consultarStockReal();
    const interval = setInterval(consultarStockReal, intervalMinutos * 60 * 1000);
    return () => clearInterval(interval);
  }, [imei, intervalMinutos, consultarStockReal]);

  return { ultimaActualizacion, polling, refrescarAhora, productosApi, error };
}
