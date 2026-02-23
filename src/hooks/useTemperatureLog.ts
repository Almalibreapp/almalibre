import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subHours, subDays } from 'date-fns';

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

// Sync temperature history from the new detailed API
const syncTemperatureHistory = async (imei: string, maquinaId: string, hours: number) => {
  const end = new Date();
  const start = new Date();
  start.setHours(start.getHours() - hours);

  const startStr = format(start, 'yyyy-MM-dd');
  const endStr = format(end, 'yyyy-MM-dd');

  try {
    const { data, error } = await supabase.functions.invoke('sync-temperatura', {
      body: { imei, maquina_id: maquinaId, start: startStr, end: endStr },
    });
    if (error) console.warn('[syncTemp] Edge function error:', error);
    return data;
  } catch (e) {
    console.warn('[syncTemp] Failed to sync:', e);
    return null;
  }
};

export const useTemperatureLog = (maquinaId: string | undefined, hours: number = 24, imei?: string) => {
  // Trigger sync when query runs
  const syncQuery = useQuery({
    queryKey: ['temperature-sync', maquinaId, hours],
    queryFn: async () => {
      if (!imei || !maquinaId) return null;
      return syncTemperatureHistory(imei, maquinaId, hours);
    },
    enabled: !!maquinaId && !!imei,
    staleTime: 2 * 60 * 1000, // Only sync every 2 minutes
    refetchInterval: 2 * 60 * 1000,
  });

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
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
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
