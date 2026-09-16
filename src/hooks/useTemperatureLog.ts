import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TemperatureReading {
  id: string;
  maquina_id: string;
  temperatura: number;
  unidad: string;
  estado: string;
  created_at: string;
  sensor?: string;
  fuente?: string;
  imei?: string;
}

interface AggregatedTemperatureReading {
  bucket_at: string;
  temperatura: number;
  estado?: string | null;
  sensor?: string | null;
}

export const useTemperatureLog = (maquinaId: string | undefined, hours: number = 24, imei?: string) => {
  const hasMachineContext = Boolean(maquinaId?.trim() && imei?.trim());

  return useQuery<TemperatureReading[]>({
    queryKey: ['temperature-log', maquinaId, imei, hours],
    queryFn: async () => {
      if (!imei?.trim()) return [];

      const { data, error } = await (supabase as any).rpc('get_temperature_history', {
        p_imei: imei.trim(),
        p_hours: hours,
      });

      if (error) throw error;
      return ((data ?? []) as AggregatedTemperatureReading[])
        .map((reading, index) => ({
          id: `${imei}-${reading.bucket_at}-${index}`,
          maquina_id: maquinaId ?? '',
          imei,
          temperatura: Number(reading.temperatura),
          unidad: 'C',
          estado: reading.estado ?? 'normal',
          sensor: reading.sensor ?? undefined,
          fuente: 'historico',
          created_at: reading.bucket_at,
        }))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    },
    enabled: hasMachineContext,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    retry: false,
  });
};

export const useLogTemperature = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      maquinaId,
      temperatura,
      unidad,
      estado,
    }: {
      maquinaId: string;
      temperatura: number;
      unidad: string;
      estado: string;
    }) => {
      const { data, error } = await supabase
        .from('lecturas_temperatura')
        .insert({
          maquina_id: maquinaId,
          temperatura,
          unidad,
          estado,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['temperature-log', variables.maquinaId] });
    },
  });
};
