import { useQuery } from '@tanstack/react-query';
import { 
  fetchMiMaquina,
  fetchVentasResumen, 
  fetchVentasDetalle, 
  fetchToppings, 
  fetchTemperatura,
  fetchEstadisticasToppings 
} from '@/services/api';

export const useMiMaquina = (imei: string | undefined) => {
  return useQuery({
    queryKey: ['mi-maquina', imei],
    queryFn: () => fetchMiMaquina(imei!),
    enabled: !!imei && imei.length > 0,
    refetchInterval: 60000,
    retry: 2,
    staleTime: 30000,
  });
};

export const useVentasResumen = (imei: string | undefined) => {
  return useQuery({
    queryKey: ['ventas-resumen', imei],
    queryFn: () => fetchVentasResumen(imei!),
    enabled: !!imei && imei.length > 0,
    refetchInterval: 60000,
    retry: 2,
    staleTime: 30000,
  });
};

export const useVentasDetalle = (imei: string | undefined) => {
  return useQuery({
    queryKey: ['ventas-detalle', imei],
    queryFn: () => fetchVentasDetalle(imei!),
    enabled: !!imei && imei.length > 0,
    refetchInterval: 60000,
    retry: 2,
    staleTime: 30000,
  });
};

export const useToppings = (imei: string | undefined) => {
  return useQuery({
    queryKey: ['toppings', imei],
    queryFn: () => fetchToppings(imei!),
    enabled: !!imei && imei.length > 0,
    refetchInterval: 60000,
    retry: 2,
    staleTime: 30000,
  });
};

export const useTemperatura = (imei: string | undefined) => {
  return useQuery({
    queryKey: ['temperatura', imei],
    queryFn: () => fetchTemperatura(imei!),
    enabled: !!imei && imei.length > 0,
    refetchInterval: 30000,
    retry: 2,
    staleTime: 15000,
  });
};

export const useEstadisticasToppings = (imei: string | undefined) => {
  return useQuery({
    queryKey: ['estadisticas-toppings', imei],
    queryFn: () => fetchEstadisticasToppings(imei!),
    enabled: !!imei && imei.length > 0,
    refetchInterval: 60000,
    retry: 2,
    staleTime: 30000,
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
