import { useQuery } from '@tanstack/react-query';
import { 
  fetchMiMaquina,
  fetchVentasResumen, 
  fetchOrdenes,
  fetchToppings, 
  fetchTemperatura,
  fetchEstadisticasToppings 
} from '@/services/api';
import { 
  TemperaturaResponse, 
  VentasResumenResponse, 
  VentasDetalleResponse, 
  ToppingsResponse 
} from '@/types';
import { fetchSpanishDayOrders } from '@/lib/sales';

export const useMiMaquina = (imei: string | undefined) => {
  return useQuery({
    queryKey: ['mi-maquina', imei],
    queryFn: () => fetchMiMaquina(imei!),
    enabled: !!imei && imei.length > 0,
    // No refetch automático - usuario controla con botón
    refetchInterval: false,
    retry: 2,
    // Mantener datos frescos por 5 minutos
    staleTime: 5 * 60 * 1000,
  });
};

export const useVentasResumen = (imei: string | undefined) => {
  return useQuery<VentasResumenResponse>({
    queryKey: ['ventas-resumen', imei],
    queryFn: () => fetchVentasResumen(imei!),
    enabled: !!imei && imei.length > 0,
    // Ventas en tiempo real
    refetchInterval: 30 * 1000,
    retry: 2,
    staleTime: 15 * 1000,
  });
};

/**
 * Fetches today's sales using dual-date approach.
 * Backend returns data by UTC date, but hora in Spain time.
 * We fetch both dates to cover the full Spain day.
 */
export const useVentasDetalle = (imei: string | undefined) => {
  const todaySpain = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });

  return useQuery<VentasDetalleResponse>({
    queryKey: ['ventas-detalle', imei, todaySpain],
    queryFn: async () => {
      if (!imei) throw new Error('No IMEI');
      const allVentas = await fetchSpanishDayOrders(imei, todaySpain, fetchOrdenes);
      return {
        mac_addr: imei,
        fecha: todaySpain,
        total_ventas: allVentas.length,
        ventas: allVentas.map(v => ({
          id: String(v.id || v.saleUid),
          hora: v.horaSpain || v.hora || '00:00',
          producto: String(v.producto || ''),
          precio: Number(v.precio || 0),
          cantidad_unidades: v.cantidad_unidades || v.cantidad || 1,
          metodo_pago: String(v.metodo_pago || ''),
          estado: String(v.estado || 'exitoso'),
          toppings: Array.isArray(v.toppings) ? v.toppings : [],
        })),
      } as VentasDetalleResponse;
    },
    enabled: !!imei && imei.length > 0,
    refetchInterval: 30 * 1000,
    retry: 2,
    staleTime: 15 * 1000,
  });
};

export const useToppings = (imei: string | undefined) => {
  return useQuery<ToppingsResponse>({
    queryKey: ['toppings', imei],
    queryFn: () => fetchToppings(imei!),
    enabled: !!imei && imei.length > 0,
    // Stock: refetch cada 5 minutos
    refetchInterval: 5 * 60 * 1000,
    retry: 2,
    staleTime: 3 * 60 * 1000,
  });
};

export const useTemperatura = (imei: string | undefined) => {
  return useQuery<TemperaturaResponse>({
    queryKey: ['temperatura', imei],
    queryFn: () => fetchTemperatura(imei!),
    enabled: !!imei && imei.length > 0,
    // Temperatura: refetch cada 2 minutos (dato más crítico)
    refetchInterval: 2 * 60 * 1000,
    retry: 2,
    staleTime: 60 * 1000,
  });
};

export const useEstadisticasToppings = (imei: string | undefined) => {
  return useQuery({
    queryKey: ['estadisticas-toppings', imei],
    queryFn: () => fetchEstadisticasToppings(imei!),
    enabled: !!imei && imei.length > 0,
    // Estadísticas: refetch cada 10 minutos
    refetchInterval: 10 * 60 * 1000,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};

// Hook combinado para datos de máquina
export const useMaquinaData = (imei: string | undefined) => {
  const ventasResumen = useVentasResumen(imei);
  const toppings = useToppings(imei);
  const temperatura = useTemperatura(imei);

  const isLoading = ventasResumen.isLoading || toppings.isLoading || temperatura.isLoading;
  const hasError = ventasResumen.isError || toppings.isError || temperatura.isError;
  const error = ventasResumen.error || toppings.error || temperatura.error;

  const refetchAll = () => {
    ventasResumen.refetch();
    toppings.refetch();
    temperatura.refetch();
  };

  return {
    ventas: ventasResumen.data,
    stock: toppings.data,
    temperatura: temperatura.data,
    isLoading,
    hasError,
    error,
    refetchAll,
    isRefetching: ventasResumen.isRefetching || toppings.isRefetching || temperatura.isRefetching,
  };
};
