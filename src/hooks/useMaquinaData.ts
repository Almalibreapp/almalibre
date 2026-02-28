import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  fetchMiMaquina,
  fetchVentasResumen, 
  fetchVentasDetalle, 
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
import { getChinaDatesForSpainDate } from '@/lib/timezone';

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
 * Fetches today's sales using BOTH China dates that map to the current Spain day.
 * This prevents the "sales stop summing" bug around midnight China time (~18h Spain).
 * 
 * Spain is 6-7h behind China, so when China crosses midnight, some of Spain's
 * "today" sales are on the previous China date. We fetch both and merge.
 */
export const useVentasDetalle = (imei: string | undefined) => {
  const todaySpain = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const chinaDates = useMemo(() => getChinaDatesForSpainDate(todaySpain), [todaySpain]);

  return useQuery<VentasDetalleResponse>({
    queryKey: ['ventas-detalle', imei, todaySpain],
    queryFn: async () => {
      if (!imei) throw new Error('No IMEI');
      // Fetch both China dates in parallel
      const results = await Promise.all(
        chinaDates.map(d => fetchOrdenes(imei, d).catch(() => null))
      );
      // Merge all ventas from both days into a single response
      const allVentas: any[] = [];
      const seenIds = new Set<string>();
      let fecha = todaySpain;
      results.forEach(r => {
        if (!r?.ventas) return;
        fecha = r.fecha || fecha;
        r.ventas.forEach((v: any) => {
          const uid = String(
            v.id
            ?? v.venta_api_id
            ?? v.numero_orden
            ?? `${v.fecha || r.fecha || todaySpain}|${v.hora || ''}|${Number(v.precio || 0)}|${v.producto || ''}|${JSON.stringify(v.toppings || [])}`
          );
          if (!seenIds.has(uid)) {
            seenIds.add(uid);
            allVentas.push(v);
          }
        });
      });
      return {
        mac_addr: imei,
        fecha,
        total_ventas: allVentas.length,
        ventas: allVentas,
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
