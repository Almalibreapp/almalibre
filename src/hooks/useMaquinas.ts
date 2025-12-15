import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Maquina } from '@/types';
import { useToast } from '@/hooks/use-toast';

export const useMaquinas = (userId: string | undefined) => {
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchMaquinas = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('maquinas')
        .select('*')
        .eq('usuario_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMaquinas(data as Maquina[]);
    } catch (error) {
      console.error('Error fetching machines:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las máquinas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaquinas();
  }, [userId]);

  const addMaquina = async (mac_address: string, nombre_personalizado: string, ubicacion: string) => {
    if (!userId) return { error: new Error('No user') };

    const { data, error } = await supabase
      .from('maquinas')
      .insert({
        usuario_id: userId,
        mac_address,
        nombre_personalizado,
        ubicacion,
      })
      .select()
      .single();

    if (!error && data) {
      setMaquinas(prev => [data as Maquina, ...prev]);
      toast({
        title: 'Máquina añadida',
        description: 'La máquina se ha registrado correctamente',
      });
    }

    return { data, error };
  };

  const updateMaquina = async (id: string, updates: Partial<Maquina>) => {
    const { data, error } = await supabase
      .from('maquinas')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      setMaquinas(prev => prev.map(m => m.id === id ? data as Maquina : m));
    }

    return { data, error };
  };

  const deleteMaquina = async (id: string) => {
    const { error } = await supabase
      .from('maquinas')
      .delete()
      .eq('id', id);

    if (!error) {
      setMaquinas(prev => prev.filter(m => m.id !== id));
      toast({
        title: 'Máquina eliminada',
        description: 'La máquina se ha eliminado correctamente',
      });
    }

    return { error };
  };

  return {
    maquinas,
    loading,
    addMaquina,
    updateMaquina,
    deleteMaquina,
    refetch: fetchMaquinas,
  };
};
