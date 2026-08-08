import { useCallback, useEffect, useMemo, useState } from 'react';
import { almaClient } from '@/integrations/alma/client';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Globe,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  User,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

type Conversacion = {
  id: string;
  phone_number: string;
  status: string | null;
  nombre_contacto: string | null;
  whatsapp_contacto: string | null;
  email_contacto: string | null;
  idioma: string | null;
  maquina_id: string | null;
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

const TIPOS: Record<string, string> = {
  incidencia_mecanica: 'Incidencia mecánica',
  incidencia_electrica: 'Incidencia eléctrica',
  stock: 'Stock',
  temperatura: 'Temperatura',
  pago: 'Problema con el cobro',
  otro: 'Otro',
};

const legibleTipo = (t?: string | null) =>
  !t ? 'Consulta' : TIPOS[t] ?? t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const IDIOMAS: Record<string, string> = { es: '🇪🇸 Español', en: '🇬🇧 English' };

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

const horaCorta = (iso: string) => {
  try {
    return format(parseISO(iso), 'd MMM, HH:mm', { locale: es });
  } catch {
    return '';
  }
};

export const AdminIncidenciasVentas = () => {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [mensajes, setMensajes] = useState<Record<string, Mensaje[]>>({});
  const [maquinas, setMaquinas] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [expandida, setExpandida] = useState<string | null>(null);
  const [actualizando, setActualizando] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<'todas' | 'abiertas' | 'resueltas'>('todas');
  const [filtroMaquina, setFiltroMaquina] = useState<string>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Máquinas propias (IMEI -> ubicación) para resolver la localización del QR escaneado
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('maquinas')
        .select('mac_address, nombre_personalizado, ubicacion');
      const mapa: Record<string, string> = {};
      (data ?? []).forEach((m: any) => {
        if (!m.mac_address) return;
        mapa[m.mac_address] = [m.nombre_personalizado, m.ubicacion].filter(Boolean).join(' · ');
      });
      setMaquinas(mapa);
    })();
  }, []);

  const cargar = useCallback(async () => {
    setErrorCarga(null);
    const { data: convs, error: errConvs } = await almaClient
      .from('conversations')
      .select('id, phone_number, status, nombre_contacto, whatsapp_contacto, email_contacto, idioma, maquina_id')
      .like('phone_number', 'web-%');

    if (errConvs) {
      setErrorCarga(errConvs.message);
      setCargando(false);
      return;
    }

    const lista = (convs as Conversacion[]) ?? [];
    setConversaciones(lista);

    if (lista.length === 0) {
      setTickets([]);
      setCargando(false);
      return;
    }

    const ids = lista.map((c) => c.id);
    const { data: tks, error: errTks } = await almaClient
      .from('tickets')
      .select('*')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false });

    if (errTks) setErrorCarga(errTks.message);
    setTickets((tks as Ticket[]) ?? []);
    setCargando(false);
  }, []);


  useEffect(() => {
    cargar();
  }, [cargar]);

  // Realtime sobre tickets y mensajes de clientes finales
  useEffect(() => {
    const canal = almaClient
      .channel('alma-incidencias-web')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => cargar())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as Mensaje;
        setMensajes((prev) =>
          prev[row.conversation_id]
            ? { ...prev, [row.conversation_id]: [...prev[row.conversation_id], row] }
            : prev
        );
      })
      .subscribe();
    return () => {
      almaClient.removeChannel(canal);
    };
  }, [cargar]);

  const cargarMensajes = async (conversationId: string) => {
    const { data } = await almaClient
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMensajes((prev) => ({ ...prev, [conversationId]: (data as Mensaje[]) ?? [] }));
  };

  const convDe = useCallback(
    (t: Ticket) => conversaciones.find((c) => c.id === t.conversation_id) ?? null,
    [conversaciones]
  );

  const ubicacionDe = useCallback(
    (t: Ticket) => {
      const c = convDe(t);
      const raw = c?.phone_number ?? t.telefono_contacto ?? '';
      const imei = (raw.match(/^(?:web|app)-([^-]+)/)?.[1] ?? raw).trim();
      return maquinas[imei] ?? (imei ? `Máquina ${imei}` : 'Máquina sin identificar');
    },
    [convDe, maquinas]
  );

  const opcionesMaquina = useMemo(() => {
    const set = new Set<string>();
    tickets.forEach((t) => set.add(ubicacionDe(t)));
    return Array.from(set).sort();
  }, [tickets, ubicacionDe]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return tickets.filter((t) => {
      const resuelto = esResuelto(t);
      if (filtroEstado === 'abiertas' && resuelto) return false;
      if (filtroEstado === 'resueltas' && !resuelto) return false;
      if (filtroMaquina !== 'todas' && ubicacionDe(t) !== filtroMaquina) return false;
      if (!q) return true;
      const c = convDe(t);
      return [t.numero_ticket, t.nombre_contacto, c?.nombre_contacto, c?.email_contacto, c?.whatsapp_contacto]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [tickets, filtroEstado, filtroMaquina, busqueda, ubicacionDe, convDe]);

  const cambiarEstado = async (t: Ticket) => {
    const resuelto = esResuelto(t);
    setActualizando(t.id);
    const { error } = await almaClient
      .from('tickets')
      .update({
        status: resuelto ? 'abierto' : 'resuelto',
        resolved_at: resuelto ? null : new Date().toISOString(),
      })
      .eq('id', t.id);
    setActualizando(null);

    if (error) {
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
          ? { ...x, status: resuelto ? 'abierto' : 'resuelto', resolved_at: resuelto ? null : new Date().toISOString() }
          : x
      )
    );
    toast({ title: resuelto ? 'Incidencia reabierta' : 'Incidencia resuelta' });
  };

  const alternar = (t: Ticket) => {
    if (expandida === t.id) {
      setExpandida(null);
      return;
    }
    setExpandida(t.id);
    if (t.conversation_id && !mensajes[t.conversation_id]) cargarMensajes(t.conversation_id);
  };

  const abiertas = tickets.filter((t) => !esResuelto(t)).length;

  return (
    <div className="space-y-5 md:space-y-8 animate-fade-in">
      <div className="rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-primary/70 p-4 md:p-8 text-primary-foreground">
        <h1 className="text-xl md:text-3xl font-display font-bold flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 md:h-8 md:w-8 shrink-0" /> Incidencias de ventas
        </h1>
        <p className="text-primary-foreground/70 mt-1">
          Reportes de clientes finales vía QR · {tickets.length} en total · {abiertas} abiertas
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3">
        <Input
          placeholder="Buscar por ticket, nombre o contacto…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="md:max-w-xs"
        />
        <Select value={filtroMaquina} onValueChange={setFiltroMaquina}>
          <SelectTrigger className="md:w-72">
            <SelectValue placeholder="Máquina" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las máquinas</SelectItem>
            {opcionesMaquina.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as typeof filtroEstado)}>
          <SelectTrigger className="md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="abiertas">Abiertas</SelectItem>
            <SelectItem value="resueltas">Resueltas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {errorCarga && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 py-4">
            <p className="text-sm text-destructive flex-1">
              No se pudieron cargar las incidencias: {errorCarga}
            </p>
            <Button size="sm" variant="outline" onClick={() => { setCargando(true); cargar(); }}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {cargando ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : visibles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay incidencias de clientes finales con estos filtros.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visibles.map((t) => {
            const c = convDe(t);
            const resuelto = esResuelto(t);
            const hilo = t.conversation_id ? mensajes[t.conversation_id] ?? [] : [];
            const fotos = hilo.filter((m) => !!m.image_url);
            const abierta = expandida === t.id;

            return (
              <Card key={t.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <button
                    onClick={() => alternar(t)}
                    className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{t.numero_ticket ?? 'Ticket'}</span>
                          <Badge variant="secondary">{legibleTipo(t.tipo_problema)}</Badge>
                          {c?.idioma && (
                            <Badge variant="outline" className="gap-1">
                              <Globe className="h-3 w-3" />
                              {IDIOMAS[c.idioma] ?? c.idioma}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 truncate">
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
                        <ChevronDown
                          className={cn('h-4 w-4 text-muted-foreground transition-transform', abierta && 'rotate-180')}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {c?.nombre_contacto ?? t.nombre_contacto ?? 'Cliente'}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {ubicacionDe(t)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {fechaLarga(t.created_at)}
                      </span>
                    </div>
                  </button>

                  {abierta && (
                    <div className="border-t p-4 space-y-4 bg-muted/10">
                      {/* Datos de contacto */}
                      <div className="grid sm:grid-cols-3 gap-3 text-sm">
                        <div className="rounded-xl border bg-background p-3">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" /> Cliente
                          </p>
                          <p className="font-medium">{c?.nombre_contacto ?? t.nombre_contacto ?? '—'}</p>
                        </div>
                        <div className="rounded-xl border bg-background p-3">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> WhatsApp
                          </p>
                          {c?.whatsapp_contacto ? (
                            <a
                              href={`https://wa.me/${c.whatsapp_contacto.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-primary hover:underline"
                            >
                              {c.whatsapp_contacto}
                            </a>
                          ) : (
                            <p className="font-medium">—</p>
                          )}
                        </div>
                        <div className="rounded-xl border bg-background p-3">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" /> Email
                          </p>
                          {c?.email_contacto ? (
                            <a
                              href={`mailto:${c.email_contacto}`}
                              className="font-medium text-primary hover:underline break-all"
                            >
                              {c.email_contacto}
                            </a>
                          ) : (
                            <p className="font-medium">—</p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border bg-background p-3">
                        <p className="text-xs text-muted-foreground mb-1">Descripción del caso</p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {t.datos_cliente?.resumen ?? 'Sin descripción registrada.'}
                        </p>
                      </div>

                      {/* Fotos adjuntas */}
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

                      {/* Hilo de chat */}
                      <div>
                        <p className="text-sm font-semibold mb-2 flex items-center gap-1">
                          <MessageSquare className="h-4 w-4" /> Conversación con Alma
                        </p>
                        <div className="rounded-xl border bg-background p-3 max-h-96 overflow-y-auto space-y-2">
                          {hilo.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Sin mensajes registrados.</p>
                          ) : (
                            hilo.map((m) => (
                              <div key={m.id} className={cn('flex', m.from_me ? 'justify-start' : 'justify-end')}>
                                <div
                                  className={cn(
                                    'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                                    m.from_me
                                      ? 'bg-muted text-foreground rounded-bl-md'
                                      : 'bg-primary/10 text-foreground rounded-br-md'
                                  )}
                                >
                                  <p className="text-[11px] font-medium text-muted-foreground mb-0.5">
                                    {m.from_me ? m.autor || 'Alma' : c?.nombre_contacto || 'Cliente'}
                                  </p>
                                  {m.image_url && (
                                    <img
                                      src={m.image_url}
                                      alt="Adjunto"
                                      className="rounded-lg mb-1.5 max-h-48 object-cover"
                                      loading="lazy"
                                    />
                                  )}
                                  {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                                  <p className="text-[10px] text-muted-foreground mt-1">{horaCorta(m.created_at)}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Button
                          variant={resuelto ? 'outline' : 'default'}
                          size="sm"
                          disabled={actualizando === t.id}
                          onClick={() => cambiarEstado(t)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          {resuelto ? 'Reabrir incidencia' : 'Marcar como resuelta'}
                        </Button>
                        {t.resolved_at && (
                          <span className="text-xs text-muted-foreground">Cerrada: {fechaLarga(t.resolved_at)}</span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminIncidenciasVentas;
