import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribes to realtime changes on ventas_historico.
 * When a new sale is inserted/updated, it invalidates all related queries
 * so the UI refreshes automatically.
 * 
 * @param imei - Optional IMEI to filter events (if omitted, listens to all)
 */
export const useVentasRealtime = (imei?: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const filter = imei
      ? { event: '*' as const, schema: 'public', table: 'ventas_historico', filter: `imei=eq.${imei}` }
      : { event: '*' as const, schema: 'public', table: 'ventas_historico' };

    const channel = supabase
      .channel(`ventas-realtime-${imei || 'all'}`)
      .on('postgres_changes', filter, () => {
        // Invalidate all queries that touch ventas data
        queryClient.invalidateQueries({ queryKey: ['ventas-resumen'] });
        queryClient.invalidateQueries({ queryKey: ['ventas-detalle'] });
        queryClient.invalidateQueries({ queryKey: ['ventas-hoy'] });
        queryClient.invalidateQueries({ queryKey: ['ventas-mes'] });
        queryClient.invalidateQueries({ queryKey: ['ventas-mes-imei'] });
        queryClient.invalidateQueries({ queryKey: ['ventas-ayer'] });
        queryClient.invalidateQueries({ queryKey: ['ventas-detalle-date'] });
        queryClient.invalidateQueries({ queryKey: ['ventas-detalle-ayer'] });
        queryClient.invalidateQueries({ queryKey: ['admin-ventas'] });
        queryClient.invalidateQueries({ queryKey: ['admin-machine-ventas-hoy'] });
        queryClient.invalidateQueries({ queryKey: ['admin-dashboard-ventas'] });
        queryClient.invalidateQueries({ queryKey: ['admin-machines-ventas'] });
        queryClient.invalidateQueries({ queryKey: ['admin-sales'] });
        queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [imei, queryClient]);
};
