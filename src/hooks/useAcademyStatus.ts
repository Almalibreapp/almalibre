import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface AcademyModulo {
  id: string;
  titulo: string;
  descripcion: string | null;
  video_url: string;
  orden: number;
  duracion_segundos: number | null;
  activo: boolean;
}

export interface AcademyProgreso {
  modulo_id: string;
  segundos_vistos: number;
  completado: boolean;
  completado_at: string | null;
}

export const useAcademyStatus = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['academy-status', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [modulosRes, progresoRes, consentRes] = await Promise.all([
        supabase.from('academy_modulos').select('*').eq('activo', true).order('orden'),
        supabase.from('academy_progreso').select('modulo_id, segundos_vistos, completado, completado_at').eq('user_id', user!.id),
        supabase.from('academy_consentimiento').select('id, aceptado_at').eq('user_id', user!.id).maybeSingle(),
      ]);

      const modulos = (modulosRes.data || []) as AcademyModulo[];
      const progreso = (progresoRes.data || []) as AcademyProgreso[];
      const consent = consentRes.data;

      const completedIds = new Set(progreso.filter((p) => p.completado).map((p) => p.modulo_id));
      const allCompleted = modulos.length > 0 && modulos.every((m) => completedIds.has(m.id));
      const certified = allCompleted && !!consent;

      return { modulos, progreso, consent, allCompleted, certified };
    },
    staleTime: 30 * 1000,
  });
};
