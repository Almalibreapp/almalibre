import { useCallback, useEffect, useRef, useState } from 'react';
import { almaClient } from '@/integrations/alma/client';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const LAST_SEEN_KEY = 'alma-soporte-last-seen';
const EVENT = 'alma-soporte-visto';

export const marcarSoporteComoLeido = () => {
  localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  window.dispatchEvent(new Event(EVENT));
};

const getLastSeen = () => localStorage.getItem(LAST_SEEN_KEY) ?? new Date(0).toISOString();

/**
 * Avisos de mensajes nuevos del equipo de soporte (intervención humana)
 * para el franquiciado, en la sección "Soporte 24/7".
 */
export const useAlmaSupportUnread = (userId?: string, enabled = true) => {
  const [noLeidos, setNoLeidos] = useState(0);
  const conversacionesRef = useRef<string[]>([]);

  const recalcular = useCallback(async () => {
    const ids = conversacionesRef.current;
    if (ids.length === 0) return setNoLeidos(0);
    const { data } = await almaClient
      .from('messages')
      .select('id, created_at, es_intervencion')
      .in('conversation_id', ids)
      .eq('es_intervencion', true)
      .gt('created_at', getLastSeen());
    setNoLeidos((data ?? []).length);
  }, []);

  useEffect(() => {
    if (!userId || !enabled) return;
    let cancelado = false;

    const init = async () => {
      const { data: maquinas } = await supabase
        .from('maquinas')
        .select('mac_address')
        .eq('usuario_id', userId);
      const telefonos = (maquinas ?? []).map((m: any) => `app-${m.mac_address}`);
      if (telefonos.length === 0 || cancelado) return;

      const { data: convs } = await almaClient
        .from('conversations')
        .select('id')
        .in('phone_number', telefonos);
      if (cancelado) return;

      conversacionesRef.current = (convs ?? []).map((c: any) => String(c.id));
      recalcular();
    };

    init();

    const onVisto = () => recalcular();
    window.addEventListener(EVENT, onVisto);

    const channel = almaClient
      .channel(`alma-soporte-unread-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as Record<string, any>;
          if (!row?.content || row.es_intervencion !== true) return;
          if (!conversacionesRef.current.includes(String(row.conversation_id))) return;
          setNoLeidos((n) => n + 1);
          toast({
            title: `${row.autor || 'Soporte Almalibre'} te ha escrito`,
            description: String(row.content).slice(0, 120),
          });
        }
      )
      .subscribe();

    return () => {
      cancelado = true;
      window.removeEventListener(EVENT, onVisto);
      almaClient.removeChannel(channel);
    };
  }, [userId, enabled, recalcular]);

  return { noLeidos, marcarLeido: marcarSoporteComoLeido };
};
