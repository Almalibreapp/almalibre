import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface DireccionGuardada {
  id: string;
  usuario_id: string;
  nombre: string;
  nombre_contacto: string;
  apellidos_contacto: string;
  email_contacto: string;
  telefono_contacto: string;
  address_1: string;
  city: string;
  postcode: string;
  country: string;
  es_favorita: boolean;
  created_at: string;
}

export function useDirecciones() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: direcciones = [], isLoading } = useQuery({
    queryKey: ['direcciones', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('direcciones_guardadas')
        .select('*')
        .eq('usuario_id', user.id)
        .order('es_favorita', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DireccionGuardada[];
    },
    enabled: !!user,
  });

  const guardarDireccion = useMutation({
    mutationFn: async (dir: Omit<DireccionGuardada, 'id' | 'usuario_id' | 'created_at'>) => {
      if (!user) throw new Error('No autenticado');
      const { data, error } = await supabase
        .from('direcciones_guardadas')
        .insert({ ...dir, usuario_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['direcciones', user?.id] }),
  });

  const actualizarDireccion = useMutation({
    mutationFn: async ({ id, ...dir }: Partial<DireccionGuardada> & { id: string }) => {
      const { data, error } = await supabase
        .from('direcciones_guardadas')
        .update(dir)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['direcciones', user?.id] }),
  });

  const eliminarDireccion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('direcciones_guardadas')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['direcciones', user?.id] }),
  });

  const marcarFavorita = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('No autenticado');
      // Unmark all
      await supabase
        .from('direcciones_guardadas')
        .update({ es_favorita: false })
        .eq('usuario_id', user.id);
      // Mark selected
      const { error } = await supabase
        .from('direcciones_guardadas')
        .update({ es_favorita: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['direcciones', user?.id] }),
  });

  return {
    direcciones,
    isLoading,
    guardarDireccion,
    actualizarDireccion,
    eliminarDireccion,
    marcarFavorita,
    favorita: direcciones.find(d => d.es_favorita) ?? direcciones[0] ?? null,
  };
}
