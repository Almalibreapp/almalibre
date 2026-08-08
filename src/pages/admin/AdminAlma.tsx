import { useEffect, useMemo, useRef, useState } from 'react';
import { almaClient } from '@/integrations/alma/client';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  MessageSquare,
  LifeBuoy,
  Ticket as TicketIcon,
  CheckCircle2,
  UserCog,
  Search,
  ChevronRight,
  Inbox,
  Leaf,
  User,
  Thermometer,
  CreditCard,
  MonitorSmartphone,
  Package,
  Wrench,
  HelpCircle,
  Clock,
  Send,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';
import { formatDistanceToNow, format, parseISO, subDays, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { applyOverrides, setOverride } from './almaOverrides';
import { TicketUpdates } from './TicketUpdates';
import { PerfilSoporteDialog } from './PerfilSoporteDialog';


type Row = Record<string, any>;

/* ---------------------------------- data --------------------------------- */

const useAlmaData = (refreshKey: number) => {
  const [conversations, setConversations] = useState<Row[]>([]);
  const [messages, setMessages] = useState<Row[]>([]);
  const [incidents, setIncidents] = useState<Row[]>([]);
  const [tickets, setTickets] = useState<Row[]>([]);
  const [maquinas, setMaquinas] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      almaClient.from('conversations').select('*').order('updated_at', { ascending: false }).limit(300),
      almaClient.from('messages').select('*').order('created_at', { ascending: true }).limit(1000),
      almaClient.from('incidents').select('*').order('created_at', { ascending: false }).limit(300),
      almaClient.from('tickets').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('maquinas').select('id, mac_address, nombre_personalizado, ubicacion'),
    ]).then(([c, m, i, t, mq]) => {
      if (!active) return;
      setConversations((c.data as Row[]) ?? []);
      setMessages((m.data as Row[]) ?? []);
      setIncidents(applyOverrides('incidents', (i.data as Row[]) ?? []));
      setTickets(applyOverrides('tickets', (t.data as Row[]) ?? []));
      setMaquinas((mq.data as Row[]) ?? []);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  return { conversations, messages, incidents, tickets, maquinas, loading };
};

/* -------------------------------- helpers -------------------------------- */

const relative = (iso?: string | null) => {
  if (!iso) return 'Sin fecha';
  try {
    return `hace ${formatDistanceToNow(parseISO(iso), { locale: es })}`;
  } catch {
    return 'Sin fecha';
  }
};

const CATEGORY_LABELS: Record<string, string> = {
  temperatura: 'Temperatura',
  pago: 'Pagos',
  pantalla: 'Pantalla',
  stock: 'Stock / Producto',
  mantenimiento: 'Mantenimiento',
};

const prettyCategory = (raw?: string | null) => {
  if (!raw) return 'Sin categoría';
  const key = raw.toLowerCase();
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  if (key.startsWith('codigo_')) return `Código de error ${key.replace('codigo_', 'E-')}`;
  return raw.replace(/_/g, ' ').replace(/^\w/, (s) => s.toUpperCase());
};

const categoryIcon = (raw?: string | null) => {
  const key = (raw ?? '').toLowerCase();
  if (key.includes('temperatura') || key.includes('frio')) return Thermometer;
  if (key.includes('pago') || key.includes('tarjeta')) return CreditCard;
  if (key.includes('pantalla') || key.includes('codigo')) return MonitorSmartphone;
  if (key.includes('stock') || key.includes('producto')) return Package;
  if (key.includes('manten')) return Wrench;
  return HelpCircle;
};

const STATUS_CONV: Record<string, { label: string; className: string }> = {
  active: { label: 'Activa', className: 'bg-success/15 text-success border-success/30' },
  paused: { label: 'Pausada', className: 'bg-warning/15 text-warning border-warning/40' },
  escalated: { label: 'Con incidencia', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  closed: { label: 'Cerrada', className: 'bg-muted text-muted-foreground border-border' },
};

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--warning))', 'hsl(var(--success))', 'hsl(var(--primary-glow))'];

/* ----------------------------- tickets unificados ---------------------------- */

export type UTicket = {
  id: string;
  tabla: 'tickets' | 'incidents';
  conversation_id: string | null;
  descripcion: string;
  categoria: string | null;
  status: string;
  resuelto: boolean;
  escalado: boolean;
  resueltoPorAlma: boolean;
  created_at: string | null;
  resolved_at: string | null;
};

const esEstadoResuelto = (s?: string | null) =>
  ['resolved', 'closed', 'resuelto', 'resuelta', 'cerrado'].includes(String(s ?? '').toLowerCase());

const esEstadoEscalado = (s?: string | null) =>
  ['escalated', 'escalada', 'escalado', 'human', 'pending_human'].includes(String(s ?? '').toLowerCase());

const toUTicket = (r: Row, tabla: 'tickets' | 'incidents'): UTicket => {
  const resuelto = esEstadoResuelto(r.status);
  const escaladoEstado = esEstadoEscalado(r.status);
  // "Resuelto por Alma sola" = se creó ya resuelto (sin pasar por escalada humana)
  const creado = r.created_at ? new Date(r.created_at).getTime() : 0;
  const cerrado = r.resolved_at ? new Date(r.resolved_at).getTime() : 0;
  const nacidoResuelto = resuelto && !!cerrado && !!creado && Math.abs(cerrado - creado) < 60_000;
  return {
    id: String(r.id),
    tabla,
    conversation_id: r.conversation_id ?? null,
    descripcion: r.description || r.descripcion || 'Sin descripción',
    categoria: r.category ?? r.categoria ?? null,
    status: String(r.status ?? ''),
    resuelto,
    escalado: escaladoEstado || (resuelto && !nacidoResuelto),
    resueltoPorAlma: nacidoResuelto,
    created_at: r.created_at ?? null,
    resolved_at: r.resolved_at ?? null,
  };
};

/** Usa la tabla `tickets`; si está vacía, deriva los tickets de `incidents`. */
const buildTickets = (tickets: Row[], incidents: Row[]): UTicket[] => {
  const base = tickets.length
    ? tickets.map((t) => toUTicket(t, 'tickets'))
    : incidents.map((i) => toUTicket(i, 'incidents'));
  return base.sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  );
};

/** Actualiza estado en el sistema de Alma; si es de solo lectura, guarda el cambio en el panel. */
const guardarEstado = async (
  tabla: 'tickets' | 'incidents',
  id: string,
  status: string,
  resolved_at: string | null
) => {
  const { data, error } = await almaClient
    .from(tabla)
    .update({ status, resolved_at })
    .eq('id', id)
    .select();
  if (error) return { ok: false as const, local: false, error };
  if (!data || data.length === 0) {
    setOverride(tabla, id, { status, resolved_at });
    return { ok: true as const, local: true, error: null };
  }
  setOverride(tabla, id, { status, resolved_at });
  return { ok: true as const, local: false, error: null };
};


/* ------------------------------- components ------------------------------ */

const StatTile = ({
  label,
  value,
  icon: Icon,
  tone = 'primary',
}: {
  label: string;
  value: number;
  icon: any;
  tone?: 'primary' | 'success' | 'warning' | 'destructive';
}) => {
  const tones: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
  };
  return (
    <Card className="rounded-2xl shadow-sm border-border/60 hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-tight">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
};

const EmptyBox = ({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) => (
  <div className="py-14 text-center space-y-2">
    <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
      <Icon className="h-6 w-6" />
    </div>
    <p className="text-sm font-medium">{title}</p>
    {subtitle && <p className="text-xs text-muted-foreground max-w-sm mx-auto">{subtitle}</p>}
  </div>
);

const LoadingList = () => (
  <div className="space-y-3">
    {[0, 1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-20 w-full rounded-2xl" />
    ))}
  </div>
);

/* -------------------------------- reportes -------------------------------- */

const Reportes = ({ data }: { data: ReturnType<typeof useAlmaData> }) => {
  const { conversations, incidents, tickets, loading } = data;
  const [rango, setRango] = useState('7');

  const uTickets = useMemo(() => buildTickets(tickets, incidents), [tickets, incidents]);

  const activas = conversations.filter((c) => String(c.status).toLowerCase() === 'active').length;
  const ticketsAbiertos = uTickets.filter((t) => !t.resuelto).length;
  const ticketsResueltos = uTickets.filter((t) => t.resuelto).length;
  const resueltas = uTickets.filter((t) => t.resueltoPorAlma).length;
  const escaladas = uTickets.filter((t) => t.escalado).length;

  const donut = [
    { name: 'Resueltos por Alma', value: resueltas },
    { name: 'Escalados a una persona', value: escaladas },
  ].filter((d) => d.value > 0);


  const categorias = useMemo(() => {
    const map = new Map<string, number>();
    incidents.forEach((i) => {
      const k = prettyCategory(i.category);
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map, ([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [incidents]);

  const serie = useMemo(() => {
    const days = parseInt(rango, 10);
    const base = Array.from({ length: days }, (_, idx) => {
      const d = startOfDay(subDays(new Date(), days - 1 - idx));
      return { key: format(d, 'yyyy-MM-dd'), dia: format(d, 'd MMM', { locale: es }), Conversaciones: 0, Incidencias: 0 };
    });
    const index = new Map(base.map((b) => [b.key, b]));
    conversations.forEach((c) => {
      const k = c.updated_at ? format(parseISO(c.updated_at), 'yyyy-MM-dd') : '';
      const hit = index.get(k);
      if (hit) hit.Conversaciones += 1;
    });
    incidents.forEach((i) => {
      const k = i.created_at ? format(parseISO(i.created_at), 'yyyy-MM-dd') : '';
      const hit = index.get(k);
      if (hit) hit.Incidencias += 1;
    });
    return base;
  }, [conversations, incidents, rango]);

  if (loading) return <LoadingList />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile label="Tickets abiertos" value={ticketsAbiertos} icon={TicketIcon} tone="destructive" />
        <StatTile label="Tickets resueltos" value={ticketsResueltos} icon={CheckCircle2} tone="success" />
        <StatTile label="Resueltos por Alma sola" value={resueltas} icon={Leaf} tone="success" />
        <StatTile label="Escalados a una persona" value={escaladas} icon={UserCog} tone="warning" />
        <StatTile label="Conversaciones activas" value={activas} icon={MessageSquare} />
      </div>


      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Resolución de tickets</CardTitle>
          </CardHeader>
          <CardContent>
            {donut.length === 0 ? (
              <EmptyBox icon={LifeBuoy} title="Todavía no hay tickets registrados" />

            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donut} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {donut.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? 'hsl(var(--success))' : 'hsl(var(--warning))'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--card))',
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            {donut.length > 0 && (
              <div className="flex justify-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-success" /> Resueltos por Alma ({resueltas})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-warning" /> Escalados ({escaladas})
                </span>

              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Problemas más frecuentes</CardTitle>
          </CardHeader>
          <CardContent>
            {categorias.length === 0 ? (
              <EmptyBox icon={HelpCircle} title="Sin categorías todavía" />
            ) : (
              <div style={{ height: Math.max(200, categorias.length * 38) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categorias} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--card))',
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="total" name="Incidencias" radius={[0, 8, 8, 0]} fill="hsl(var(--primary))" barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-1 flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Actividad diaria</CardTitle>
          <Select value={rango} onValueChange={setRango}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="14">Últimos 14 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gConv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--warning))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--warning))" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="Conversaciones" stroke="hsl(var(--primary))" fill="url(#gConv)" strokeWidth={2} />
                <Area type="monotone" dataKey="Incidencias" stroke="hsl(var(--warning))" fill="url(#gInc)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/* ----------------------------- conversaciones ----------------------------- */

const Conversaciones = ({
  data,
  nombreDe,
  onRefresh,
}: {
  data: ReturnType<typeof useAlmaData>;
  nombreDe: (c: Row) => { titulo: string; canal: string };
  onRefresh: () => void;
}) => {
  const { conversations, messages, loading } = data;
  const { profile, user, updateProfile } = useAuth();
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const [abierta, setAbierta] = useState<Row | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [enviados, setEnviados] = useState<Row[]>([]);
  const [entrantes, setEntrantes] = useState<Row[]>([]);
  const [estadoLocal, setEstadoLocal] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const nombreAdmin = [profile?.nombre?.trim(), profile?.apellidos?.trim()].filter(Boolean).join(' ') ||
    user?.email?.split('@')[0] ||
    'Soporte Almalibre';
  const cargoAdmin = profile?.cargo?.trim() || 'Soporte Almalibre';

  const estadoDe = (c: Row) => String(estadoLocal[String(c.id)] ?? c.status ?? '').toLowerCase();
  const iaPausada = abierta ? estadoDe(abierta) === 'paused' : false;

  const filtradas = conversations.filter((c) =>
    nombreDe(c).titulo.toLowerCase().includes(busqueda.toLowerCase())
  );

  const hilo = useMemo(() => {
    if (!abierta) return [] as Row[];
    const todos = [
      ...messages.filter((m) => m.conversation_id === abierta.id),
      ...entrantes.filter((m) => m.conversation_id === abierta.id),
      ...enviados.filter((m) => m.conversation_id === abierta.id),
    ];
    const vistos = new Set<string>();
    return todos
      .filter((m) => {
        const k = String(m.id);
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
      })
      .sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
  }, [abierta, messages, entrantes, enviados]);

  // Realtime del hilo abierto
  useEffect(() => {
    if (!abierta?.id) return;
    const channel = almaClient
      .channel(`admin-alma-${abierta.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${abierta.id}` },
        (payload) => {
          const row = payload.new as Row;
          if (!row?.content) return;
          setEntrantes((prev) => (prev.some((m) => String(m.id) === String(row.id)) ? prev : [...prev, row]));
        }
      )
      .subscribe();
    return () => {
      almaClient.removeChannel(channel);
    };
  }, [abierta?.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
  }, [hilo.length, abierta?.id]);

  const llamarIntervenir = async (payload: Record<string, unknown>) => {
    const { data: res, error } = await supabase.functions.invoke('alma-intervenir', { body: payload });
    if (error || (res as any)?.error) throw new Error('intervencion_fallida');
    return res;
  };

  const cambiarEstadoIA = async (pausar: boolean) => {
    if (!abierta || cambiandoEstado) return;
    setCambiandoEstado(true);
    const id = String(abierta.id);
    try {
      await llamarIntervenir({
        conversationId: id,
        autor: nombreAdmin,
        cargo: cargoAdmin,
        mensaje: '',
        soloEstado: true,
        pausarIA: pausar,
      });
    } catch {
      // Fallback: cambiar el estado directamente en la base de Alma
      const { error } = await almaClient
        .from('conversations')
        .update({ status: pausar ? 'paused' : 'active' })
        .eq('id', id);
      if (error) {
        toast({
          title: 'No se pudo cambiar el estado de Alma',
          description: 'Inténtalo de nuevo en unos segundos.',
          variant: 'destructive',
        });
        setCambiandoEstado(false);
        return;
      }
    }
    setEstadoLocal((prev) => ({ ...prev, [id]: pausar ? 'paused' : 'active' }));
    toast({
      title: pausar ? 'Alma pausada' : 'Alma reactivada',
      description: pausar
        ? 'El franquiciado solo verá los mensajes que escribas tú.'
        : 'Alma vuelve a responder con normalidad.',
    });
    setCambiandoEstado(false);
    onRefresh();
  };

  const enviarMensaje = async () => {
    const mensaje = texto.trim();
    if (!mensaje || !abierta || enviando) return;
    const id = String(abierta.id);
    setEnviando(true);
    // Optimista
    const localId = `local-${Date.now()}`;
    setEnviados((prev) => [
      ...prev,
      {
        id: localId,
        conversation_id: abierta.id,
        content: mensaje,
        from_me: true,
        es_intervencion: true,
        autor: nombreAdmin,
        cargo: cargoAdmin,
        created_at: new Date().toISOString(),
      },
    ]);
    setTexto('');
    try {
      await llamarIntervenir({
        conversationId: id,
        autor: nombreAdmin,
        mensaje,
        pausarIA: true,
        cargo: cargoAdmin,
        fotoUrl: profile?.foto_url ?? undefined,
      });
      setEstadoLocal((prev) => ({ ...prev, [id]: 'paused' }));
      onRefresh();
    } catch {
      setEnviados((prev) => prev.filter((m) => m.id !== localId));
      setTexto(mensaje);
      toast({
        title: 'No se pudo enviar el mensaje',
        description: 'Inténtalo de nuevo en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setEnviando(false);
    }
  };

  if (loading) return <LoadingList />;
  if (conversations.length === 0)
    return <EmptyBox icon={Inbox} title="Aún no hay conversaciones" subtitle="Cuando alguien escriba a Alma, aparecerá aquí." />;

  const panelChat = abierta && (
    <div className="flex flex-col h-full min-h-0">
      {/* Cabecera de la conversación */}
      <div className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2.5 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8 text-primary-foreground hover:bg-primary-foreground/10"
          onClick={() => setAbierta(null)}
          aria-label="Volver a la lista"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
        </Button>
        <div className="w-9 h-9 rounded-full bg-primary-foreground/15 flex items-center justify-center shrink-0">
          <MessageSquare className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{nombreDe(abierta).titulo}</p>
          <p className="text-[11px] text-primary-foreground/75 truncate">
            {nombreDe(abierta).canal} · {relative(abierta.updated_at)}
          </p>
        </div>
      </div>

      {/* Toggle de estado de Alma */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-2.5 shrink-0">
        <div className="min-w-0">
          <p className={cn('text-xs font-semibold', iaPausada ? 'text-warning' : 'text-success')}>
            {iaPausada ? 'IA pausada' : 'IA activa'}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {iaPausada
              ? 'Alma está en silencio: solo escribes tú.'
              : 'Alma responde automáticamente al franquiciado.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {cambiandoEstado && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <Switch
            checked={iaPausada}
            disabled={cambiandoEstado}
            onCheckedChange={(v) => cambiarEstadoIA(v)}
            aria-label="Pausar o reactivar a Alma"
          />
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl h-8 w-8"
            onClick={() => setPerfilAbierto(true)}
            aria-label="Editar mi perfil de soporte"
          >
            <UserCog className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-2 bg-secondary"
        style={{
          backgroundImage: 'radial-gradient(hsl(var(--primary) / 0.07) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
        }}
      >
        {hilo.length === 0 && <EmptyBox icon={MessageSquare} title="Esta conversación aún no tiene mensajes" />}
        {hilo.map((m) => {
          const humano = m.es_intervencion === true;
          return (
            <div key={m.id} className={cn('flex items-end gap-2', m.from_me ? 'justify-start' : 'justify-end')}>
              {m.from_me && (
                <div
                  className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                    humano ? 'bg-warning text-warning-foreground' : 'bg-primary text-primary-foreground'
                  )}
                >
                  {humano ? <UserCog className="h-3.5 w-3.5" /> : <Leaf className="h-3.5 w-3.5" />}
                </div>
              )}
              <div
                className={cn(
                  'max-w-[80%] px-3.5 py-2 rounded-2xl shadow-sm text-sm',
                  humano
                    ? 'bg-warning/15 border border-warning/40 rounded-bl-md'
                    : m.from_me
                    ? 'bg-card rounded-bl-md'
                    : 'bg-primary text-primary-foreground rounded-br-md'
                )}
              >
                {humano && (
                  <p className="text-[11px] font-semibold text-warning mb-0.5">
                    {(m.autor || m.author || 'Soporte')} ({m.cargo || 'Soporte Almalibre'})
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                <p className={cn('text-[10px] mt-1 text-right', m.from_me ? 'text-muted-foreground' : 'text-primary-foreground/70')}>
                  {m.created_at ? format(parseISO(m.created_at), 'HH:mm', { locale: es }) : ''}
                </p>
              </div>
              {!m.from_me && (
                <div className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center shrink-0">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Composer tipo mensajería */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviarMensaje();
        }}
        className="border-t border-border bg-background p-3 flex items-end gap-2 shrink-0"
      >
        <Textarea
          rows={1}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              enviarMensaje();
            }
          }}
          placeholder={`Escribe como ${nombreAdmin}…`}
          className="resize-none rounded-2xl text-sm min-h-[44px] max-h-28 flex-1"
        />
        <Button
          type="submit"
          size="icon"
          className="h-11 w-11 rounded-full shrink-0"
          disabled={!texto.trim() || enviando}
          aria-label="Enviar mensaje"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );

  return (
    <>
      <div className="grid md:grid-cols-[320px_1fr] gap-0 h-[calc(100vh-13rem)] min-h-[520px] rounded-2xl border border-border/60 overflow-hidden bg-card shadow-sm">
        {/* Lista de conversaciones */}
        <aside
          className={cn(
            'flex-col border-r border-border/60 bg-background min-h-0',
            abierta ? 'hidden md:flex' : 'flex'
          )}
        >
          <div className="p-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversación…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9 rounded-xl"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-1">
            {filtradas.map((c) => {
              const info = nombreDe(c);
              const pausada = estadoDe(c) === 'paused';
              const msgs = messages.filter((m) => m.conversation_id === c.id);
              const ultimo = msgs[msgs.length - 1];
              const activa = abierta?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setAbierta(c)}
                  className={cn(
                    'w-full text-left rounded-xl p-2.5 flex items-center gap-3 transition-colors',
                    activa ? 'bg-primary/10' : 'hover:bg-muted/60'
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate flex-1">{info.titulo}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {c.updated_at ? format(parseISO(c.updated_at), 'HH:mm', { locale: es }) : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground truncate flex-1">
                        {ultimo?.content ? String(ultimo.content) : info.canal}
                      </p>
                      {pausada && (
                        <Badge
                          variant="outline"
                          className="text-[9px] shrink-0 bg-warning/15 text-warning border-warning/40"
                        >
                          IA pausada
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            {filtradas.length === 0 && <EmptyBox icon={Search} title="Sin resultados para esa búsqueda" />}
          </div>
        </aside>

        {/* Panel de chat */}
        <section className={cn('min-h-0', abierta ? 'flex flex-col' : 'hidden md:flex')}>
          {abierta ? (
            panelChat
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <EmptyBox
                icon={MessageSquare}
                title="Selecciona una conversación"
                subtitle="Elige un chat de la lista para leer el hilo y responder al franquiciado."
              />
            </div>
          )}
        </section>
      </div>

      <PerfilSoporteDialog
        open={perfilAbierto}
        onOpenChange={setPerfilAbierto}
        profile={profile as any}
        userId={user?.id}
        onSaved={(p) => updateProfile?.(p as any)}
      />
    </>
  );
};



/* ------------------------------- incidencias ------------------------------ */

const Incidencias = ({
  data,
  nombreDeConversacion,
  onRefresh,
}: {
  data: ReturnType<typeof useAlmaData>;
  nombreDeConversacion: (id: string | null) => string;
  onRefresh: () => void;
}) => {
  const { incidents, loading } = data;
  const [filtro, setFiltro] = useState<'todas' | 'pendientes' | 'resueltas'>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState<string | null>(null);

  const esResuelta = (s: string) => ['resolved', 'closed', 'resuelta'].includes(String(s).toLowerCase());

  const lista = incidents
    .filter((i) => (filtro === 'todas' ? true : filtro === 'resueltas' ? esResuelta(i.status) : !esResuelta(i.status)))
    .filter((i) => nombreDeConversacion(i.conversation_id).toLowerCase().includes(busqueda.toLowerCase()));

  const cambiarEstado = async (inc: Row) => {
    const resuelta = esResuelta(inc.status);
    const nuevo = resuelta ? 'escalated' : 'resolved';
    setGuardando(inc.id);
    const res = await guardarEstado(
      'incidents',
      String(inc.id),
      nuevo,
      nuevo === 'resolved' ? new Date().toISOString() : null
    );
    setGuardando(null);
    if (!res.ok) {
      toast({
        title: 'No se pudo actualizar',
        description: 'El sistema de Alma rechazó el cambio de estado.',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: nuevo === 'resolved' ? 'Incidencia marcada como resuelta' : 'Incidencia reabierta',
      description: res.local ? 'Guardado en el panel (el sistema de Alma es de solo lectura).' : undefined,
    });
    onRefresh();
  };


  if (loading) return <LoadingList />;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1.5">
          {(['todas', 'pendientes', 'resueltas'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filtro === f ? 'default' : 'outline'}
              className="rounded-full capitalize"
              onClick={() => setFiltro(f)}
            >
              {f}
            </Button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por máquina…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
      </div>

      {lista.length === 0 ? (
        <EmptyBox icon={LifeBuoy} title="No hay incidencias que mostrar" subtitle="Prueba a cambiar el filtro o la búsqueda." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {lista.map((inc) => {
            const Icon = categoryIcon(inc.category);
            const resuelta = esResuelta(inc.status);
            return (
              <Card key={inc.id} className="rounded-2xl shadow-sm border-border/60">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                        resuelta ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{nombreDeConversacion(inc.conversation_id)}</p>
                      <p className="text-xs text-muted-foreground">{prettyCategory(inc.category)}</p>
                    </div>
                    <Badge
                      className={cn(
                        'shrink-0 border',
                        resuelta
                          ? 'bg-success/15 text-success border-success/30 hover:bg-success/15'
                          : 'bg-warning/15 text-warning border-warning/40 hover:bg-warning/15'
                      )}
                    >
                      {resuelta ? 'Resuelta' : 'Pendiente'}
                    </Badge>
                  </div>

                  <p className="text-sm text-foreground/80 leading-relaxed">{inc.description || 'Sin descripción'}</p>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {relative(inc.created_at)}
                    </span>
                    <Button size="sm" variant={resuelta ? 'outline' : 'default'} className="rounded-full" onClick={() => cambiarEstado(inc)} disabled={guardando === inc.id}>
                      {resuelta ? 'Reabrir' : 'Marcar como resuelta'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* --------------------------------- tickets -------------------------------- */

const Tickets = ({
  data,
  nombreDeConversacion,
  onRefresh,
}: {
  data: ReturnType<typeof useAlmaData>;
  nombreDeConversacion: (id: string | null) => string;
  onRefresh: () => void;
}) => {
  const { tickets, incidents, messages, loading } = data;
  const [guardando, setGuardando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'abiertos' | 'resueltos'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<UTicket | null>(null);

  const lista = useMemo(() => buildTickets(tickets, incidents), [tickets, incidents]);

  const filtrados = lista
    .filter((t) => (filtro === 'todos' ? true : filtro === 'resueltos' ? t.resuelto : !t.resuelto))
    .filter((t) => nombreDeConversacion(t.conversation_id).toLowerCase().includes(busqueda.toLowerCase()));

  const hilo = abierto ? messages.filter((m) => m.conversation_id === abierto.conversation_id) : [];

  const cambiarEstado = async (t: UTicket) => {
    const nuevo = t.resuelto ? 'abierto' : 'resuelto';
    const statusRemoto = t.resuelto ? (t.tabla === 'tickets' ? 'open' : 'escalated') : 'resolved';
    setGuardando(t.id);
    const res = await guardarEstado(
      t.tabla,
      t.id,
      statusRemoto,
      nuevo === 'resuelto' ? new Date().toISOString() : null
    );
    setGuardando(null);
    if (!res.ok) {
      toast({
        title: 'No se pudo actualizar',
        description: 'El sistema de Alma rechazó el cambio de estado.',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: nuevo === 'resuelto' ? 'Ticket resuelto' : 'Ticket reabierto',
      description: res.local ? 'Guardado en el panel (el sistema de Alma es de solo lectura).' : undefined,
    });
    setAbierto(null);
    onRefresh();
  };

  if (loading) return <LoadingList />;
  if (lista.length === 0)
    return (
      <EmptyBox
        icon={TicketIcon}
        title="Aún no hay tickets registrados"
        subtitle="Cuando un franquiciado abra una consulta con Alma, la verás aquí."
      />
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1.5">
          {(['todos', 'abiertos', 'resueltos'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filtro === f ? 'default' : 'outline'}
              className="rounded-full capitalize"
              onClick={() => setFiltro(f)}
            >
              {f}
            </Button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por máquina…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
      </div>

      {filtrados.length === 0 ? (
        <EmptyBox icon={TicketIcon} title="No hay tickets que mostrar" subtitle="Prueba a cambiar el filtro o la búsqueda." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtrados.map((t) => {
            const Icon = categoryIcon(t.categoria);
            return (
              <Card key={t.id} className="rounded-2xl shadow-sm border-border/60">
                <CardContent className="p-4 space-y-3">
                  <button className="w-full text-left" onClick={() => setAbierto(t)}>
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                          t.resuelto ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{nombreDeConversacion(t.conversation_id)}</p>
                        <p className="text-xs text-muted-foreground truncate">{prettyCategory(t.categoria)}</p>
                      </div>
                      <Badge
                        className={cn(
                          'shrink-0 border',
                          t.resuelto
                            ? 'bg-success/15 text-success border-success/30 hover:bg-success/15'
                            : 'bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/15'
                        )}
                      >
                        {t.resuelto ? 'Resuelto' : 'Abierto'}
                      </Badge>
                    </div>
                  </button>

                  <p className="text-sm text-foreground/80 leading-relaxed line-clamp-2">{t.descripcion}</p>

                  <div className="flex flex-wrap gap-1.5">
                    {t.resueltoPorAlma && (
                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                        <Leaf className="h-3 w-3 mr-1" /> Resuelto por Alma sola
                      </Badge>
                    )}
                    {t.escalado && (
                      <Badge variant="outline" className="text-[10px] bg-warning/15 text-warning border-warning/40">
                        <UserCog className="h-3 w-3 mr-1" /> Escalado a una persona
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {relative(t.created_at)}
                    </span>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setAbierto(t)}>
                        Ver detalle
                      </Button>
                      <Button
                        size="sm"
                        variant={t.resuelto ? 'outline' : 'default'}
                        className="rounded-full"
                        onClick={() => cambiarEstado(t)}
                        disabled={guardando === t.id}
                      >
                        {t.resuelto ? 'Reabrir' : 'Marcar como resuelto'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!abierto} onOpenChange={(o) => !o && setAbierto(null)}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="bg-primary text-primary-foreground p-4 space-y-0.5">
            <DialogTitle className="text-base text-primary-foreground">
              {abierto ? nombreDeConversacion(abierto.conversation_id) : ''}
            </DialogTitle>
            <p className="text-xs text-primary-foreground/75">
              {abierto ? prettyCategory(abierto.categoria) : ''}
            </p>
          </DialogHeader>

          {abierto && (
            <div className="p-4 space-y-3 border-b border-border">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Apertura</p>
                  <p className="font-medium">
                    {abierto.created_at
                      ? format(parseISO(abierto.created_at), "d MMM yyyy · HH:mm", { locale: es })
                      : 'Sin datos'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cierre</p>
                  <p className="font-medium">
                    {abierto.resolved_at
                      ? format(parseISO(abierto.resolved_at), "d MMM yyyy · HH:mm", { locale: es })
                      : 'Sigue abierto'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge
                  className={cn(
                    'border',
                    abierto.resuelto
                      ? 'bg-success/15 text-success border-success/30 hover:bg-success/15'
                      : 'bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/15'
                  )}
                >
                  {abierto.resuelto ? 'Resuelto' : 'Abierto'}
                </Badge>
                {abierto.resueltoPorAlma && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    Sin intervención humana
                  </Badge>
                )}
                {abierto.escalado && (
                  <Badge variant="outline" className="bg-warning/15 text-warning border-warning/40">
                    Escalado a soporte humano
                  </Badge>
                )}
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{abierto.descripcion}</p>
            </div>
          )}

          <div
            className="max-h-[45vh] overflow-y-auto p-3 space-y-2 bg-secondary"
            style={{
              backgroundImage: 'radial-gradient(hsl(var(--primary) / 0.07) 1px, transparent 1px)',
              backgroundSize: '26px 26px',
            }}
          >
            {hilo.length === 0 && <EmptyBox icon={MessageSquare} title="Sin conversación asociada" />}
            {hilo.map((m) => (
              <div key={m.id} className={cn('flex items-end gap-2', m.from_me ? 'justify-start' : 'justify-end')}>
                {m.from_me && (
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Leaf className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] px-3.5 py-2 rounded-2xl shadow-sm text-sm',
                    m.from_me ? 'bg-card rounded-bl-md' : 'bg-primary text-primary-foreground rounded-br-md'
                  )}
                >
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                  <p
                    className={cn(
                      'text-[10px] mt-1 text-right',
                      m.from_me ? 'text-muted-foreground' : 'text-primary-foreground/70'
                    )}
                  >
                    {m.created_at ? format(parseISO(m.created_at), 'HH:mm', { locale: es }) : ''}
                  </p>
                </div>
                {!m.from_me && (
                  <div className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center shrink-0">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {abierto && <TicketUpdates ticketId={abierto.id} />}

          {abierto && (
            <div className="p-3 border-t border-border">
              <Button
                className="w-full rounded-full"
                variant={abierto.resuelto ? 'outline' : 'default'}
                onClick={() => cambiarEstado(abierto)}
                disabled={guardando === abierto.id}
              >
                {abierto.resuelto ? 'Reabrir ticket' : 'Marcar como resuelto'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};


/* ---------------------------------- page ---------------------------------- */

export const AdminAlma = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const data = useAlmaData(refreshKey);

  const porImei = useMemo(() => {
    const m = new Map<string, Row>();
    data.maquinas.forEach((mq) => m.set(String(mq.mac_address), mq));
    return m;
  }, [data.maquinas]);

  const nombreDe = (c: Row): { titulo: string; canal: string } => {
    const raw = String(c?.phone_number ?? '');
    if (raw.startsWith('app-')) {
      const imei = raw.replace('app-', '');
      const mq = porImei.get(imei);
      return {
        titulo: mq ? `${mq.nombre_personalizado}${mq.ubicacion ? ` · ${mq.ubicacion}` : ''}` : 'Máquina sin nombre',
        canal: 'Desde la app',
      };
    }
    if (raw.startsWith('telegram-')) return { titulo: 'Cliente por Telegram', canal: 'Telegram' };
    if (raw.startsWith('wa-') || /^\+?\d{6,}$/.test(raw)) return { titulo: 'Cliente por WhatsApp', canal: 'WhatsApp' };
    return { titulo: 'Conversación de soporte', canal: 'Soporte Alma' };
  };

  const conversacionesPorId = useMemo(() => {
    const m = new Map<string, Row>();
    data.conversations.forEach((c) => m.set(String(c.id), c));
    return m;
  }, [data.conversations]);

  const nombreDeConversacion = (id: string | null) => {
    const c = id ? conversacionesPorId.get(String(id)) : null;
    return c ? nombreDe(c).titulo : 'Máquina no identificada';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold">Panel de Alma</h1>
          <p className="text-sm text-muted-foreground">Resumen del soporte automático de Almalibre</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => setRefreshKey((k) => k + 1)}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      <Tabs defaultValue="reportes">
        <TabsList className="w-full overflow-x-auto justify-start rounded-xl">
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
          <TabsTrigger value="conversations">Conversaciones</TabsTrigger>
          <TabsTrigger value="incidents">Incidencias</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="reportes" className="mt-4">
          <Reportes data={data} />
        </TabsContent>
        <TabsContent value="conversations" className="mt-4">
          <Conversaciones data={data} nombreDe={nombreDe} onRefresh={() => setRefreshKey((k) => k + 1)} />
        </TabsContent>
        <TabsContent value="incidents" className="mt-4">
          <Incidencias data={data} nombreDeConversacion={nombreDeConversacion} onRefresh={() => setRefreshKey((k) => k + 1)} />
        </TabsContent>
        <TabsContent value="tickets" className="mt-4">
          <Tickets data={data} nombreDeConversacion={nombreDeConversacion} onRefresh={() => setRefreshKey((k) => k + 1)} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
