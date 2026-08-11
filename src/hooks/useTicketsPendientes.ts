import { useEffect, useMemo, useState } from 'react';
import { almaClient } from '@/integrations/alma/client';
import { useAuth } from '@/hooks/useAuth';
import { useMaquinas } from '@/hooks/useMaquinas';

type TicketRow = {
  id: string;
  status: string | null;
  resolved_at: string | null;
  conversation_id: string | null;
  maquina_id: string | null;
};

const esResuelto = (t: TicketRow) =>
  !!t.resolved_at || ['resuelto', 'resolved', 'cerrado', 'closed'].includes(String(t.status).toLowerCase());

const imeiDe = (raw?: string | null) => (raw ?? '').match(/^(?:web|app)-(\d+)/)?.[1] ?? '';

export const useTicketsPendientes = () => {
  const { user } = useAuth();
  const { maquinas } = useMaquinas(user?.id);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);

  const imeis = useMemo(
    () => Array.from(new Set(maquinas.map((m) => m.mac_address).filter(Boolean))),
    [maquinas]
  );

  useEffect(() => {
    let cancelled = false;

    const cargar = async () => {
      if (imeis.length === 0) {
        setTickets([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const filtros = imeis.flatMap((i) => [`phone_number.like.web-${i}*`, `phone_number.like.app-${i}*`]);
      const { data: convs, error: errConvs } = await almaClient
        .from('conversations')
        .select('id, phone_number, maquina_id')
        .or(filtros.join(','));

      if (cancelled) return;

      if (errConvs || !convs) {
        setTickets([]);
        setLoading(false);
        return;
      }

      const lista = convs as { id: string; phone_number: string; maquina_id: string | null }[];
      const convIds = lista.map((c) => c.id);
      const maquinaIds = Array.from(new Set(lista.map((c) => c.maquina_id).filter(Boolean) as string[]));

      const orTickets: string[] = [];
      if (convIds.length) orTickets.push(`conversation_id.in.(${convIds.join(',')})`);
      if (maquinaIds.length) orTickets.push(`maquina_id.in.(${maquinaIds.join(',')})`);

      if (orTickets.length === 0) {
        setTickets([]);
        setLoading(false);
        return;
      }

      const { data: tks, error: errTks } = await almaClient
        .from('tickets')
        .select('id, status, resolved_at, conversation_id, maquina_id')
        .or(orTickets.join(','));

      if (!cancelled) {
        setTickets((tks as TicketRow[]) ?? []);
        setLoading(false);
      }
    };

    cargar();

    // Realtime: actualizar si cambia cualquier ticket
    const canal = almaClient
      .channel('tickets-pendientes-resumen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => cargar())
      .subscribe();

    return () => {
      cancelled = true;
      almaClient.removeChannel(canal);
    };
  }, [imeis]);

  const pendientes = useMemo(() => tickets.filter((t) => !esResuelto(t)).length, [tickets]);

  return { pendientes, total: tickets.length, loading };
};
