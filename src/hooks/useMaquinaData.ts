import { useQuery } from '@tanstack/react-query';
import { fetchVentas, fetchStock, fetchTemperatura } from '@/services/api';
import { VentasResponse, StockResponse, TemperaturaResponse } from '@/types';

export const useVentas = (macAddress: string | undefined, fechaInicio?: string, fechaFin?: string) => {
  return useQuery<VentasResponse, Error>({
    queryKey: ['ventas', macAddress, fechaInicio, fechaFin],
    queryFn: () => fetchVentas(macAddress!, fechaInicio, fechaFin),
    enabled: !!macAddress,
    refetchInterval: 60000, // Refrescar cada minuto
    retry: 1,
    staleTime: 30000,
  });
};

export const useStock = (macAddress: string | undefined) => {
  return useQuery<StockResponse, Error>({
    queryKey: ['stock', macAddress],
    queryFn: () => fetchStock(macAddress!),
    enabled: !!macAddress,
    refetchInterval: 60000,
    retry: 1,
    staleTime: 30000,
  });
};

export const useTemperatura = (macAddress: string | undefined) => {
  return useQuery<TemperaturaResponse, Error>({
    queryKey: ['temperatura', macAddress],
    queryFn: () => fetchTemperatura(macAddress!),
    enabled: !!macAddress,
    refetchInterval: 30000, // Refrescar cada 30 segundos
    retry: 1,
    staleTime: 15000,
  });
};

export const useMaquinaData = (macAddress: string | undefined) => {
  const ventas = useVentas(macAddress);
  const stock = useStock(macAddress);
  const temperatura = useTemperatura(macAddress);

  const isLoading = ventas.isLoading || stock.isLoading || temperatura.isLoading;
  const hasError = ventas.isError || stock.isError || temperatura.isError;
  const error = ventas.error || stock.error || temperatura.error;

  const refetchAll = () => {
    ventas.refetch();
    stock.refetch();
    temperatura.refetch();
  };

  return {
    ventas: ventas.data,
    stock: stock.data,
    temperatura: temperatura.data,
    isLoading,
    hasError,
    error,
    refetchAll,
    isRefetching: ventas.isRefetching || stock.isRefetching || temperatura.isRefetching,
  };
};
