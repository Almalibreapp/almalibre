import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Notificacion, PreferenciasNotificaciones } from '@/types/notifications';

export const useNotificaciones = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notificaciones = [], isLoading, refetch } = useQuery({
    queryKey: ['notificaciones', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('notificaciones')
        .select('*')
        .eq('usuario_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notificacion[];
    },
    enabled: !!user,
    refetchInterval: 60000, // Refetch cada minuto
  });

  const noLeidas = notificaciones.filter(n => !n.leida).length;

  const marcarComoLeida = useMutation({
    mutationFn: async (notificacionId: string) => {
      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: true })
        .eq('id', notificacionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones', user?.id] });
    }
  });

  const marcarTodasComoLeidas = useMutation({
    mutationFn: async () => {
      if (!user) return;
      
      const { error } = await supabase
        .from('notificaciones')
        .update({ leida: true })
        .eq('usuario_id', user.id)
        .eq('leida', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones', user?.id] });
    }
  });

  const eliminarNotificacion = useMutation({
    mutationFn: async (notificacionId: string) => {
      const { error } = await supabase
        .from('notificaciones')
        .delete()
        .eq('id', notificacionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones', user?.id] });
    }
  });

  const eliminarTodasLasNotificaciones = useMutation({
    mutationFn: async () => {
      if (!user) return;
      
      const { error } = await supabase
        .from('notificaciones')
        .delete()
        .eq('usuario_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones', user?.id] });
    }
  });

  return {
    notificaciones,
    noLeidas,
    isLoading,
    refetch,
    marcarComoLeida: marcarComoLeida.mutate,
    marcarTodasComoLeidas: marcarTodasComoLeidas.mutate,
    eliminarNotificacion: eliminarNotificacion.mutate,
    eliminarTodasLasNotificaciones: eliminarTodasLasNotificaciones.mutate,
  };
};

export const usePreferenciasNotificaciones = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferencias, isLoading, refetch } = useQuery({
    queryKey: ['preferencias_notificaciones', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('preferencias_notificaciones')
        .select('*')
        .eq('usuario_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as PreferenciasNotificaciones | null;
    },
    enabled: !!user,
  });

  const actualizarPreferencias = useMutation({
    mutationFn: async (updates: Partial<PreferenciasNotificaciones>) => {
      if (!user) throw new Error('Usuario no autenticado');

      const { data: existing } = await supabase
        .from('preferencias_notificaciones')
        .select('id')
        .eq('usuario_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('preferencias_notificaciones')
          .update(updates)
          .eq('usuario_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('preferencias_notificaciones')
          .insert({
            usuario_id: user.id,
            ...updates
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferencias_notificaciones', user?.id] });
    }
  });

  // Valores por defecto si no hay preferencias guardadas
  const preferenciasConDefaults: PreferenciasNotificaciones = preferencias || {
    id: '',
    usuario_id: user?.id || '',
    stock_bajo: true,
    temperatura_alerta: true,
    nuevas_ventas: false,
    pedidos: true,
    incidencias: true,
    promociones: true,
    canal_push: true,
    canal_email: true,
    umbral_stock: 20,
    updated_at: new Date().toISOString(),
  };

  return {
    preferencias: preferenciasConDefaults,
    isLoading,
    refetch,
    actualizarPreferencias: actualizarPreferencias.mutate,
    isUpdating: actualizarPreferencias.isPending,
  };
};
