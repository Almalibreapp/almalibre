import { useCallback, useEffect, useState } from 'react';
import { almaClient } from '@/integrations/alma/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClipboardList, Plus, User } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export type TicketUpdate = {
  id: string;
  ticket_id: string;
  nota: string;
  autor: string | null;
  created_at: string;
};

const LOCAL_KEY = 'alma-ticket-updates-v1';

const readLocal = (): Record<string, TicketUpdate[]> => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
  } catch {
    return {};
  }
};

const saveLocal = (ticketId: string, update: TicketUpdate) => {
  const store = readLocal();
  store[ticketId] = [update, ...(store[ticketId] ?? [])];
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
  } catch {
    /* noop */
  }
};

const relative = (iso: string) => {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: es });
  } catch {
    return '';
  }
};

export const TicketUpdates = ({ ticketId, autor }: { ticketId: string; autor?: string | null }) => {
  const [items, setItems] = useState<TicketUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await almaClient
      .from('ticket_updates')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });

    const remotas = ((data as TicketUpdate[]) ?? []).map((r) => ({ ...r }));
    const locales = readLocal()[ticketId] ?? [];
    const ids = new Set(remotas.map((r) => r.id));
    const todas = [...remotas, ...locales.filter((l) => !ids.has(l.id))].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setItems(todas);
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const añadir = async () => {
    const texto = nota.trim();
    if (!texto) return;
    setGuardando(true);
    const nueva: TicketUpdate = {
      id: crypto.randomUUID(),
      ticket_id: ticketId,
      nota: texto,
      autor: autor ?? 'Administración',
      created_at: new Date().toISOString(),
    };

    const { data, error } = await almaClient
      .from('ticket_updates')
      .insert({ ticket_id: ticketId, nota: texto, autor: nueva.autor })
      .select()
      .maybeSingle();

    if (error || !data) {
      saveLocal(ticketId, nueva);
      setItems((prev) => [nueva, ...prev]);
      toast({
        title: 'Actualización añadida',
        description: 'Guardada en el panel (el sistema de Alma es de solo lectura).',
      });
    } else {
      setItems((prev) => [data as TicketUpdate, ...prev]);
      toast({ title: 'Actualización añadida' });
    }

    setNota('');
    setGuardando(false);
  };

  return (
    <div className="p-4 space-y-3 border-t border-border">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">Actualizaciones</h4>
        <span className="text-[11px] text-muted-foreground">Solo visible para administración</span>
      </div>

      <div className="space-y-2">
        <Textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej.: Se determinó la raíz del problema…"
          rows={2}
          className="rounded-xl resize-none text-sm"
        />
        <Button
          size="sm"
          className="rounded-full w-full"
          onClick={añadir}
          disabled={guardando || !nota.trim()}
        >
          <Plus className="h-4 w-4 mr-1" /> Añadir actualización
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Todavía no hay actualizaciones para este ticket.</p>
      ) : (
        <ol className="relative max-h-52 overflow-y-auto pl-5 space-y-3">
          <span className="absolute left-[7px] top-1 bottom-1 w-px bg-border" aria-hidden />
          {items.map((u) => (
            <li key={u.id} className="relative">
              <span className="absolute -left-5 top-1.5 w-3.5 h-3.5 rounded-full bg-primary/15 border-2 border-primary" />
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">{u.nota}</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                {u.autor && (
                  <>
                    <User className="h-3 w-3" />
                    {u.autor} ·
                  </>
                )}
                {relative(u.created_at)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
