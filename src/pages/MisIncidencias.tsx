import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { almaClient } from '@/integrations/alma/client';
import { useAuth } from '@/hooks/useAuth';
import { useMaquinas } from '@/hooks/useMaquinas';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BottomNav } from '@/components/layout/BottomNav';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, AlertTriangle, ClipboardList, Clock, ChevronRight, User } from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

type Ticket = {
  id: string;
  numero_ticket: string | null;
  tipo_problema: string | null;
  status: string | null;
  created_at: string;
  resolved_at: string | null;
  conversation_id: string | null;
  maquina_id: string | null;
  telefono_contacto: string | null;
  datos_cliente: { resumen?: string } | null;
};

type Update = {
  id: string;
  ticket_id: string;
  nota: string;
  autor: string | null;
  created_at: string;
};

const TIPOS: Record<string, string> = {
  incidencia_mecanica: 'Incidencia mecánica',
  incidencia_electrica: 'Incidencia eléctrica',
  stock: 'Stock',
  temperatura: 'Temperatura',
  pago: 'Pagos',
  otro: 'Otro',
};

const legibleTipo = (t?: string | null) =>
  !t ? 'Consulta' : TIPOS[t] ?? t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const estaResuelto = (t: Ticket) =>
  !!t.resolved_at || ['resuelto', 'resolved', 'cerrado', 'closed'].includes(String(t.status).toLowerCase());

const fechaLarga = (iso: string) => {
  try {
    return format(parseISO(iso), "d 'de' MMMM yyyy, HH:mm", { locale: es });
  } catch {
    return '';
  }
};

const relativa = (iso: string) => {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: es });
  } catch {
    return '';
  }
};

export const MisIncidencias = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { maquinas } = useMaquinas(user?.id);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [abierto, setAbierto] = useState<Ticket | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [cargandoUpdates, setCargandoUpdates] = useState(false);

  const imeis = useMemo(() => maquinas.map((m) => m.mac_address).filter(Boolean), [maquinas]);
  const [convIds, setConvIds] = useState<string[]>([]);
  const [maquinaIds, setMaquinaIds] = useState<string[]>([]);

  const nombreMaquina = useCallback(
    (t: Ticket) => {
      const imei = (t.telefono_contacto ?? '').replace('app-', '');
      return maquinas.find((m) => m.mac_address === imei)?.nombre_personalizado ?? 'Mi máquina';
    },
    [maquinas]
  );

  // 1) Resolver conversaciones/máquinas de Alma a partir de los IMEIs del franquiciado
  useEffect(() => {
    if (imeis.length === 0) {
      setConvIds([]);
      setMaquinaIds([]);
      if (maquinas.length === 0) setLoading(false);
      return;
    }
    (async () => {
      const { data } = await almaClient
        .from('conversations')
        .select('id, phone_number, maquina_id')
        .in('phone_number', imeis.map((i) => `app-${i}`));

      const rows = (data as { id: string; maquina_id: string | null }[]) ?? [];
      setConvIds(rows.map((r) => r.id));
      setMaquinaIds(rows.map((r) => r.maquina_id).filter(Boolean) as string[]);
    })();
  }, [imeis, maquinas.length]);

  const cargarTickets = useCallback(async () => {
    if (imeis.length === 0) return;
    const filtros: string[] = imeis.map((i) => `telefono_contacto.eq.app-${i}`);
    if (convIds.length) filtros.push(`conversation_id.in.(${convIds.join(',')})`);
    if (maquinaIds.length) filtros.push(`maquina_id.in.(${maquinaIds.join(',')})`);

    const { data } = await almaClient
      .from('tickets')
      .select('*')
      .or(filtros.join(','))
      .order('created_at', { ascending: false });

    setTickets((data as Ticket[]) ?? []);
    setLoading(false);
  }, [imeis, convIds, maquinaIds]);

  useEffect(() => {
    cargarTickets();
  }, [cargarTickets]);

  // 2) Realtime: cambios de estado y nuevas actualizaciones
  useEffect(() => {
    if (imeis.length === 0) return;
    const canal = almaClient
      .channel('alma-tickets-franquiciado')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => cargarTickets())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_updates' }, (payload) => {
        const row = payload.new as Update;
        setAbierto((actual) => {
          if (actual && row?.ticket_id === actual.id) {
            setUpdates((prev) =>
              prev.some((u) => u.id === row.id)
                ? prev
                : [row, ...prev].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
            );
          }
          return actual;
        });
      })
      .subscribe();

    return () => {
      almaClient.removeChannel(canal);
    };
  }, [imeis, cargarTickets]);

  const abrirTicket = async (t: Ticket) => {
    setAbierto(t);
    setUpdates([]);
    setCargandoUpdates(true);
    const { data } = await almaClient
      .from('ticket_updates')
      .select('*')
      .eq('ticket_id', t.id)
      .order('created_at', { ascending: false });
    setUpdates((data as Update[]) ?? []);
    setCargandoUpdates(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center h-16 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="mr-3">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Incidencias</h1>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-14 w-14 text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-1">Sin incidencias</h2>
              <p className="text-muted-foreground text-sm mb-4">
                No hay tickets abiertos para tus máquinas. Puedes reportar cualquier problema desde el chat de Alma.
              </p>
              <Button onClick={() => navigate('/soporte-alma')}>Hablar con Alma</Button>
            </CardContent>
          </Card>
        ) : (
          tickets.map((t) => {
            const resuelto = estaResuelto(t);
            return (
              <Card
                key={t.id}
                onClick={() => abrirTicket(t)}
                className="cursor-pointer hover:shadow-md transition-shadow animate-fade-in"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{t.numero_ticket ?? 'Ticket'}</p>
                      <p className="text-sm text-muted-foreground truncate">{legibleTipo(t.tipo_problema)}</p>
                    </div>
                    <Badge
                      className={
                        resuelto
                          ? 'bg-success-light text-success shrink-0'
                          : 'bg-warning-light text-warning-foreground shrink-0'
                      }
                    >
                      {resuelto ? 'Resuelto' : 'Abierto'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 truncate">
                      <Clock className="h-3 w-3" />
                      {fechaLarga(t.created_at)}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </main>

      <Dialog open={!!abierto} onOpenChange={(o) => !o && setAbierto(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">{abierto?.numero_ticket ?? 'Ticket'}</DialogTitle>
          </DialogHeader>

          {abierto && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={
                    estaResuelto(abierto)
                      ? 'bg-success-light text-success'
                      : 'bg-warning-light text-warning-foreground'
                  }
                >
                  {estaResuelto(abierto) ? 'Resuelto' : 'Abierto'}
                </Badge>
                <Badge variant="secondary">{legibleTipo(abierto.tipo_problema)}</Badge>
                <span className="text-xs text-muted-foreground">{nombreMaquina(abierto)}</span>
              </div>

              <div className="rounded-xl bg-muted/50 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Descripción del caso</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {abierto.datos_cliente?.resumen || 'Sin descripción registrada.'}
                </p>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>Apertura: {fechaLarga(abierto.created_at)}</p>
                {abierto.resolved_at && <p>Cierre: {fechaLarga(abierto.resolved_at)}</p>}
              </div>

              <div className="space-y-3 border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">Actualizaciones</h4>
                </div>

                {cargandoUpdates ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full rounded-xl" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                ) : updates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Todavía no hay actualizaciones para este ticket.
                  </p>
                ) : (
                  <ol className="relative pl-5 space-y-3">
                    <span className="absolute left-[7px] top-1 bottom-1 w-px bg-border" aria-hidden />
                    {updates.map((u) => (
                      <li key={u.id} className="relative">
                        <span className="absolute -left-5 top-1.5 w-3.5 h-3.5 rounded-full bg-primary/15 border-2 border-primary" />
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{u.nota}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          {u.autor && (
                            <>
                              <User className="h-3 w-3" />
                              {u.autor} ·
                            </>
                          )}
                          {relativa(u.created_at)}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

export default MisIncidencias;
