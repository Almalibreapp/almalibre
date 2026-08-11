import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { almaClient } from '@/integrations/alma/client';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMaquinas } from '@/hooks/useMaquinas';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BottomNav } from '@/components/layout/BottomNav';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  User,
} from 'lucide-react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

type Conversacion = {
  id: string;
  phone_number: string;
  maquina_id: string | null;
  nombre_contacto: string | null;
  whatsapp_contacto: string | null;
  email_contacto: string | null;
  idioma: string | null;
};

type Ticket = {
  id: string;
  numero_ticket: string | null;
  tipo_problema: string | null;
  status: string | null;
  created_at: string;
  resolved_at: string | null;
  conversation_id: string | null;
  maquina_id: string | null;
  nombre_contacto: string | null;
  telefono_contacto: string | null;
  datos_cliente: { resumen?: string } | null;
};

type Mensaje = {
  id: string;
  conversation_id: string;
  content: string | null;
  from_me: boolean;
  image_url: string | null;
  autor: string | null;
  created_at: string;
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
  no_enciende: 'No enciende',
  stock: 'Stock',
  temperatura: 'Temperatura',
  pago: 'Problema con el cobro',
  otro: 'Otro',
};

const legibleTipo = (t?: string | null) =>
  !t ? 'Consulta' : TIPOS[t] ?? t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const esResuelto = (t: Ticket) =>
  !!t.resolved_at || ['resuelto', 'resolved', 'cerrado', 'closed'].includes(String(t.status).toLowerCase());

const fechaLarga = (iso?: string | null) => {
  if (!iso) return '';
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

const imeiDe = (raw?: string | null) => (raw ?? '').match(/^(?:web|app)-(\d+)/)?.[1] ?? '';

export const MisIncidencias = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { maquinas } = useMaquinas(user?.id);

  const [nombreFranquiciado, setNombreFranquiciado] = useState('Franquiciado');
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [mensajes, setMensajes] = useState<Record<string, Mensaje[]>>({});
  const [updates, setUpdates] = useState<Record<string, Update[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [actualizando, setActualizando] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [enviandoNota, setEnviandoNota] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<'todas' | 'abiertas' | 'resueltas'>('todas');
  const [filtroMaquina, setFiltroMaquina] = useState<string>('todas');
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Config de email de avisos
  const [emailsConfig, setEmailsConfig] = useState<Record<string, string>>({});
  const [maquinaAlmaId, setMaquinaAlmaId] = useState<Record<string, string>>({});
  const [imeiConfig, setImeiConfig] = useState<string>('');
  const [emailInput, setEmailInput] = useState('');
  const [guardandoEmail, setGuardandoEmail] = useState(false);

  const imeis = useMemo(
    () => Array.from(new Set(maquinas.map((m) => m.mac_address).filter(Boolean))),
    [maquinas]
  );

  const nombreDeImei = useCallback(
    (imei: string) => {
      const m = maquinas.find((x) => x.mac_address === imei);
      return m ? [m.nombre_personalizado, m.ubicacion].filter(Boolean).join(' · ') : `Máquina ${imei}`;
    },
    [maquinas]
  );

  useEffect(() => {
    if (!imeiConfig && imeis.length > 0) setImeiConfig(imeis[0]);
  }, [imeis, imeiConfig]);

  useEffect(() => {
    setEmailInput(emailsConfig[imeiConfig] ?? '');
  }, [imeiConfig, emailsConfig]);

  // Nombre del franquiciado (autor de las notas)
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('nombre, apellidos')
        .eq('id', user.id)
        .maybeSingle();
      const n = [data?.nombre, data?.apellidos].filter(Boolean).join(' ').trim();
      if (n) setNombreFranquiciado(n);
    })();
  }, [user?.id]);

  // Email configurado por máquina (lectura; puede no estar disponible por RLS)
  useEffect(() => {
    if (imeis.length === 0) return;
    (async () => {
      const { data } = await almaClient
        .from('maquinas_franquicia')
        .select('id, imei, email_notificacion_incidencias')
        .in('imei', imeis);
      const emails: Record<string, string> = {};
      const ids: Record<string, string> = {};
      (data as any[] | null)?.forEach((m) => {
        if (!m?.imei) return;
        if (m.email_notificacion_incidencias) emails[m.imei] = m.email_notificacion_incidencias;
        if (m.id) ids[m.imei] = m.id;
      });
      setEmailsConfig((prev) => ({ ...emails, ...prev }));
      setMaquinaAlmaId((prev) => ({ ...ids, ...prev }));
    })();
  }, [imeis]);

  const cargar = useCallback(async () => {
    if (imeis.length === 0) {
      if (maquinas.length === 0) return;
      setTickets([]);
      setLoading(false);
      return;
    }
    setErrorCarga(null);

    const filtros = imeis.flatMap((i) => [`phone_number.like.web-${i}*`, `phone_number.like.app-${i}*`]);
    const { data: convs, error: errConvs } = await almaClient
      .from('conversations')
      .select('id, phone_number, maquina_id, nombre_contacto, whatsapp_contacto, email_contacto, idioma')
      .or(filtros.join(','));

    if (errConvs) {
      setErrorCarga(errConvs.message);
      setLoading(false);
      return;
    }

    const lista = (convs as Conversacion[]) ?? [];
    setConversaciones(lista);

    // maquina_id de Alma por IMEI (para configurar el email de avisos)
    setMaquinaAlmaId((prev) => {
      const next = { ...prev };
      lista.forEach((c) => {
        const imei = imeiDe(c.phone_number);
        if (imei && c.maquina_id && !next[imei]) next[imei] = c.maquina_id;
      });
      return next;
    });

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
      .select('*')
      .or(orTickets.join(','))
      .order('created_at', { ascending: false });

    if (errTks) setErrorCarga(errTks.message);
    setTickets((tks as Ticket[]) ?? []);
    setLoading(false);
  }, [imeis, maquinas.length]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Realtime: cambios de estado, mensajes y actualizaciones
  useEffect(() => {
    if (imeis.length === 0) return;
    const canal = almaClient
      .channel('alma-mis-incidencias')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => cargar())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as Mensaje;
        setMensajes((prev) =>
          prev[row.conversation_id]
            ? {
                ...prev,
                [row.conversation_id]: prev[row.conversation_id].some((m) => m.id === row.id)
                  ? prev[row.conversation_id]
                  : [...prev[row.conversation_id], row],
              }
            : prev
        );
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_updates' }, (payload) => {
        const row = payload.new as Update;
        if (!row?.ticket_id) return;
        setUpdates((prev) =>
          prev[row.ticket_id]
            ? {
                ...prev,
                [row.ticket_id]: prev[row.ticket_id].some((u) => u.id === row.id)
                  ? prev[row.ticket_id]
                  : [row, ...prev[row.ticket_id]],
              }
            : prev
        );
      })
      .subscribe();

    return () => {
      almaClient.removeChannel(canal);
    };
  }, [imeis, cargar]);

  const convDe = useCallback(
    (t: Ticket) => conversaciones.find((c) => c.id === t.conversation_id) ?? null,
    [conversaciones]
  );

  const imeiDeTicket = useCallback(
    (t: Ticket) => imeiDe(convDe(t)?.phone_number ?? t.telefono_contacto),
    [convDe]
  );

  const visibles = useMemo(
    () =>
      tickets.filter((t) => {
        const resuelto = esResuelto(t);
        if (filtroEstado === 'abiertas' && resuelto) return false;
        if (filtroEstado === 'resueltas' && !resuelto) return false;
        if (filtroMaquina !== 'todas' && imeiDeTicket(t) !== filtroMaquina) return false;
        return true;
      }),
    [tickets, filtroEstado, filtroMaquina, imeiDeTicket]
  );

  const cargarDetalle = async (t: Ticket) => {
    if (t.conversation_id && !mensajes[t.conversation_id]) {
      const { data } = await almaClient
        .from('messages')
        .select('*')
        .eq('conversation_id', t.conversation_id)
        .order('created_at', { ascending: true });
      setMensajes((prev) => ({ ...prev, [t.conversation_id!]: (data as Mensaje[]) ?? [] }));
    }
    if (!updates[t.id]) {
      const { data } = await almaClient
        .from('ticket_updates')
        .select('*')
        .eq('ticket_id', t.id)
        .order('created_at', { ascending: false });
      setUpdates((prev) => ({ ...prev, [t.id]: (data as Update[]) ?? [] }));
    }
  };

  const alternar = (t: Ticket) => {
    if (expandida === t.id) {
      setExpandida(null);
      return;
    }
    setExpandida(t.id);
    setNota('');
    cargarDetalle(t);
  };

  const cambiarEstado = async (t: Ticket) => {
    const resuelto = esResuelto(t);
    setActualizando(t.id);
    const { data, error } = await supabase.functions.invoke('alma-cambiar-estado-ticket', {
      body: { ticketId: t.id, nuevoEstado: resuelto ? 'abierto' : 'resuelto' },
    });
    setActualizando(null);

    if (error || (data as any)?.error) {
      toast({
        title: 'No se pudo cambiar el estado',
        description: 'El sistema de Alma no ha aceptado la actualización.',
        variant: 'destructive',
      });
      return;
    }
    setTickets((prev) =>
      prev.map((x) =>
        x.id === t.id
          ? {
              ...x,
              status: resuelto ? 'abierto' : 'resuelto',
              resolved_at: resuelto ? null : new Date().toISOString(),
            }
          : x
      )
    );
    toast({ title: resuelto ? 'Incidencia reabierta' : 'Incidencia resuelta' });
  };

  const enviarNota = async (t: Ticket) => {
    const texto = nota.trim();
    if (!texto) return;
    setEnviandoNota(true);
    const { data, error } = await supabase.functions.invoke('alma-agregar-actualizacion-ticket', {
      body: { ticketId: t.id, autor: nombreFranquiciado, nota: texto },
    });
    setEnviandoNota(false);

    if (error || (data as any)?.error) {
      toast({
        title: 'No se pudo guardar la nota',
        description: 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      });
      return;
    }
    setNota('');
    setUpdates((prev) => ({
      ...prev,
      [t.id]: [
        {
          id: `tmp-${Date.now()}`,
          ticket_id: t.id,
          nota: texto,
          autor: nombreFranquiciado,
          created_at: new Date().toISOString(),
        },
        ...(prev[t.id] ?? []),
      ],
    }));
    toast({ title: 'Nota añadida' });
  };

  const guardarEmail = async () => {
    const email = emailInput.trim();
    const maquinaId = maquinaAlmaId[imeiConfig];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: 'Email no válido', variant: 'destructive' });
      return;
    }
    if (!maquinaId) {
      toast({
        title: 'Máquina no disponible',
        description: 'Todavía no hay incidencias registradas para esta máquina en el sistema de Alma.',
        variant: 'destructive',
      });
      return;
    }
    setGuardandoEmail(true);
    const { data, error } = await supabase.functions.invoke('alma-configurar-email-incidencias', {
      body: { maquinaId, email },
    });
    setGuardandoEmail(false);

    if (error || (data as any)?.error) {
      toast({ title: 'No se pudo guardar el email', variant: 'destructive' });
      return;
    }
    setEmailsConfig((prev) => ({ ...prev, [imeiConfig]: email }));
    toast({ title: 'Email de avisos actualizado' });
  };

  const abiertas = tickets.filter((t) => !esResuelto(t)).length;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center h-16 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="mr-3">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Mis Incidencias</h1>
        </div>
      </header>

      <main className="container px-4 py-5 space-y-5">
        <div className="rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-primary/70 p-4 text-primary-foreground">
          <h2 className="text-lg font-display font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" /> Incidencias de clientes
          </h2>
          <p className="text-xs text-primary-foreground/80 mt-1">
            {loading ? 'Cargando…' : `${tickets.length} en total · ${abiertas} abiertas`}
          </p>
        </div>

        {/* Configuración de avisos */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Avisos de nuevas incidencias</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Email al que quieres recibir los avisos de nuevas incidencias de tu máquina.
            </p>
            {imeis.length > 1 && (
              <Select value={imeiConfig} onValueChange={setImeiConfig}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Máquina" />
                </SelectTrigger>
                <SelectContent>
                  {imeis.map((i) => (
                    <SelectItem key={i} value={i}>
                      {nombreDeImei(i)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Actual:{' '}
              <span className="font-medium text-foreground">
                {emailsConfig[imeiConfig] || 'sin configurar'}
              </span>
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                inputMode="email"
                placeholder="tucorreo@ejemplo.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="text-base sm:text-sm"
              />
              <Button onClick={guardarEmail} disabled={guardandoEmail} className="shrink-0">
                <Mail className="h-4 w-4 mr-2" />
                Guardar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filtros */}
        <div className="grid grid-cols-2 gap-2">
          <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as typeof filtroEstado)}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="abiertas">Abiertas</SelectItem>
              <SelectItem value="resueltas">Resueltas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroMaquina} onValueChange={setFiltroMaquina}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Máquina" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las máquinas</SelectItem>
              {imeis.map((i) => (
                <SelectItem key={i} value={i}>
                  {nombreDeImei(i)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {errorCarga && (
          <Card className="border-destructive/40">
            <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 py-4">
              <p className="text-sm text-destructive flex-1">No se pudieron cargar las incidencias: {errorCarga}</p>
              <Button size="sm" variant="outline" onClick={() => { setLoading(true); cargar(); }}>
                Reintentar
              </Button>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : visibles.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                No hay incidencias con estos filtros.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {visibles.map((t) => {
              const c = convDe(t);
              const resuelto = esResuelto(t);
              const hilo = t.conversation_id ? mensajes[t.conversation_id] ?? [] : [];
              const fotos = hilo.filter((m) => !!m.image_url);
              const notas = updates[t.id] ?? [];
              const abierta = expandida === t.id;

              return (
                <Card key={t.id} className="overflow-hidden animate-fade-in">
                  <CardContent className="p-0">
                    <button onClick={() => alternar(t)} className="w-full text-left p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{t.numero_ticket ?? 'Ticket'}</span>
                            <Badge variant="secondary" className="text-[11px]">{legibleTipo(t.tipo_problema)}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {t.datos_cliente?.resumen ?? 'Sin resumen'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            className={
                              resuelto
                                ? 'bg-green-500/10 text-green-700 border-green-500/30'
                                : 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                            }
                          >
                            {resuelto ? 'Resuelto' : 'Abierto'}
                          </Badge>
                          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', abierta && 'rotate-180')} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 min-w-0">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate">{c?.nombre_contacto ?? t.nombre_contacto ?? 'Cliente'}</span>
                        </span>
                        <span className="flex items-center gap-1 min-w-0">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{nombreDeImei(imeiDeTicket(t))}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          {fechaLarga(t.created_at)}
                        </span>
                      </div>
                    </button>

                    {abierta && (
                      <div className="border-t p-4 space-y-4 bg-muted/10">
                        {/* Contacto */}
                        <div className="grid gap-2 sm:grid-cols-3 text-sm">
                          <div className="rounded-xl border bg-background p-3 min-w-0">
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" /> Cliente
                            </p>
                            <p className="font-medium truncate">{c?.nombre_contacto ?? t.nombre_contacto ?? '—'}</p>
                          </div>
                          <div className="rounded-xl border bg-background p-3 min-w-0">
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" /> WhatsApp
                            </p>
                            {c?.whatsapp_contacto ? (
                              <a
                                href={`https://wa.me/${c.whatsapp_contacto.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-primary hover:underline break-all"
                              >
                                {c.whatsapp_contacto}
                              </a>
                            ) : (
                              <p className="font-medium">—</p>
                            )}
                          </div>
                          <div className="rounded-xl border bg-background p-3 min-w-0">
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" /> Email
                            </p>
                            {c?.email_contacto ? (
                              <a href={`mailto:${c.email_contacto}`} className="font-medium text-primary hover:underline break-all">
                                {c.email_contacto}
                              </a>
                            ) : (
                              <p className="font-medium">—</p>
                            )}
                          </div>
                        </div>

                        <div className="rounded-xl border bg-background p-3">
                          <p className="text-[11px] text-muted-foreground mb-1">Descripción del caso</p>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {t.datos_cliente?.resumen ?? 'Sin descripción registrada.'}
                          </p>
                        </div>

                        {fotos.length > 0 && (
                          <div>
                            <p className="text-sm font-semibold mb-2">Fotos adjuntas</p>
                            <div className="flex gap-2 flex-wrap">
                              {fotos.map((m) => (
                                <a key={m.id} href={m.image_url!} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={m.image_url!}
                                    alt="Foto enviada por el cliente"
                                    className="h-24 w-24 rounded-xl object-cover border hover:opacity-80 transition-opacity"
                                    loading="lazy"
                                  />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Conversación */}
                        <div>
                          <p className="text-sm font-semibold mb-2 flex items-center gap-1">
                            <MessageSquare className="h-4 w-4" /> Conversación con Alma
                          </p>
                          <div className="rounded-xl border bg-background p-3 max-h-80 overflow-y-auto space-y-2">
                            {hilo.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Sin mensajes registrados.</p>
                            ) : (
                              hilo.map((m) => (
                                <div key={m.id} className={cn('flex', m.from_me ? 'justify-start' : 'justify-end')}>
                                  <div
                                    className={cn(
                                      'max-w-[85%] rounded-2xl px-3 py-2 text-sm break-words',
                                      m.from_me ? 'bg-muted rounded-bl-md' : 'bg-primary/10 rounded-br-md'
                                    )}
                                  >
                                    <p className="text-[11px] font-medium text-muted-foreground mb-0.5">
                                      {m.from_me ? m.autor || 'Alma' : c?.nombre_contacto || 'Cliente'}
                                    </p>
                                    {m.image_url && (
                                      <img
                                        src={m.image_url}
                                        alt="Adjunto"
                                        className="rounded-lg mb-1 max-h-40 object-cover"
                                        loading="lazy"
                                      />
                                    )}
                                    {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Notas de seguimiento */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold flex items-center gap-1">
                            <ClipboardList className="h-4 w-4" /> Seguimiento
                          </p>
                          {notas.length > 0 && (
                            <ol className="relative pl-5 space-y-3">
                              <span className="absolute left-[7px] top-1 bottom-1 w-px bg-border" aria-hidden />
                              {notas.map((u) => (
                                <li key={u.id} className="relative">
                                  <span className="absolute -left-5 top-1.5 w-3.5 h-3.5 rounded-full bg-primary/15 border-2 border-primary" />
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{u.nota}</p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {u.autor ? `${u.autor} · ` : ''}
                                    {relativa(u.created_at)}
                                  </p>
                                </li>
                              ))}
                            </ol>
                          )}
                          <Textarea
                            value={nota}
                            onChange={(e) => setNota(e.target.value)}
                            placeholder="Añade una nota de seguimiento…"
                            rows={3}
                            className="text-base sm:text-sm resize-none"
                          />
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              onClick={() => enviarNota(t)}
                              disabled={enviandoNota || !nota.trim()}
                              className="flex-1"
                            >
                              <Send className="h-4 w-4 mr-2" /> Añadir nota
                            </Button>
                            <Button
                              variant={resuelto ? 'outline' : 'default'}
                              onClick={() => cambiarEstado(t)}
                              disabled={actualizando === t.id}
                              className="flex-1"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              {resuelto ? 'Reabrir incidencia' : 'Marcar como resuelta'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default MisIncidencias;
