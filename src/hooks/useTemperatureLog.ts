import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TemperatureReading {
  id: string;
  maquina_id: string;
  temperatura: number;
  unidad: string;
  estado: string;
  created_at: string;
}

export const useTemperatureLog = (maquinaId: string | undefined, hours: number = 24) => {
  return useQuery<TemperatureReading[]>({
    queryKey: ['temperature-log', maquinaId, hours],
    queryFn: async () => {
      const since = new Date();
      since.setHours(since.getHours() - hours);

      const { data, error } = await supabase
        .from('lecturas_temperatura')
        .select('*')
        .eq('maquina_id', maquinaId!)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as TemperatureReading[];
    },
    enabled: !!maquinaId,
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
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
