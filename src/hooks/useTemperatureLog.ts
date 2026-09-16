import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

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

interface RawTemperatureReading {
  id: string | number;
  imei: string;
  temperatura: number;
  estado?: string | null;
  sensor?: string | null;
  fuente?: string | null;
  timestamp?: string | null;
  created_at: string;
}

const getReadingTimestamp = (reading: RawTemperatureReading) => {
  const rawTimestamp = reading.timestamp?.trim();
  if (rawTimestamp && /^\d{4}-\d{2}-\d{2}[ T]/.test(rawTimestamp)) {
    return rawTimestamp.includes('T') ? rawTimestamp : rawTimestamp.replace(' ', 'T');
  }
  if (rawTimestamp && /^\d{1,2}:\d{2}/.test(rawTimestamp)) {
    const day = reading.created_at.slice(0, 10);
    return `${day}T${rawTimestamp}`;
  }
  return reading.created_at;
};

// Sync temperature history from the new detailed API
const syncTemperatureHistory = async (imei: string, maquinaId: string, hours: number) => {
  if (!imei?.trim() || !maquinaId?.trim()) return null;

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
  const hasMachineContext = Boolean(maquinaId?.trim() && imei?.trim());

  // Trigger sync when query runs
  const syncQuery = useQuery({
    queryKey: ['temperature-sync', maquinaId, imei, hours],
    queryFn: async () => {
      if (!imei || !maquinaId) return null;
      return syncTemperatureHistory(imei, maquinaId, hours);
    },
    enabled: hasMachineContext,
    staleTime: 2 * 60 * 1000, // Only sync every 2 minutes
    refetchInterval: 2 * 60 * 1000,
  });

  return useQuery<TemperatureReading[]>({
    queryKey: ['temperature-log', maquinaId, imei, hours],
    queryFn: async () => {
      if (!imei?.trim()) return [];

      const since = new Date();
      since.setHours(since.getHours() - hours);

      const { data, error } = await (supabase as any)
        .from('temperatura_historica')
        .select('id, imei, temperatura, estado, sensor, fuente, timestamp, created_at')
        .eq('imei', imei.trim())
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(10000);

      if (error) throw error;
      return ((data ?? []) as RawTemperatureReading[])
        .map((reading) => ({
          id: String(reading.id),
          maquina_id: maquinaId ?? '',
          imei: reading.imei,
          temperatura: Number(reading.temperatura),
          unidad: 'C',
          estado: reading.estado ?? 'normal',
          sensor: reading.sensor ?? undefined,
          fuente: reading.fuente ?? undefined,
          created_at: getReadingTimestamp(reading),
        }))
        .filter((reading) => {
          const readingTime = new Date(reading.created_at).getTime();
          return Number.isFinite(readingTime) && readingTime >= since.getTime();
        })
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    },
    enabled: hasMachineContext,
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
