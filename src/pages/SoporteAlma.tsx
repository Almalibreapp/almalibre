import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useMaquinas } from '@/hooks/useMaquinas';
import { supabase } from '@/integrations/supabase/client';
import { almaClient } from '@/integrations/alma/client';
import { ArrowLeft, Send, Loader2, User, AlertTriangle, Leaf, ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ChatMsg {
  id: string;
  autor: 'usuario' | 'alma' | 'error';
  texto: string;
  hora: string;
  /** Nombre del humano de soporte cuando el mensaje es una intervención */
  nombreAutor?: string;
}

const nowTime = () =>
  new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

const SUGERENCIAS = [
  'La máquina no dispensa açaí',
  'Error en pantalla',
  'No acepta pagos con tarjeta',
  'Temperatura fuera de rango',
];

/** Altura real disponible (descuenta el teclado en iOS/Android) */
const useViewportHeight = () => {
  const [height, setHeight] = useState<number | null>(null);
  const [offsetTop, setOffsetTop] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      setHeight(vv.height);
      setOffsetTop(vv.offsetTop);
      setKeyboardOpen(window.innerHeight - vv.height > 120);
    };
    onResize();
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, []);

  return { height, offsetTop, keyboardOpen };
};

/** Bloquea el scroll y el rebote de la página mientras el chat está abierto */
const useLockBodyScroll = () => {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyWidth: body.style.width,
      overscroll: html.style.overscrollBehavior,
    };
    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.width = '100%';
    window.scrollTo(0, 0);
    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.overscrollBehavior = prev.overscroll;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.width = prev.bodyWidth;
    };
  }, []);
};

export const SoporteAlma = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { maquinas, loading: loadingMaquinas } = useMaquinas(user?.id);
  const { height, offsetTop, keyboardOpen } = useViewportHeight();
  useLockBodyScroll();

  const [imei, setImei] = useState<string>('');
  const [mensajes, setMensajes] = useState<ChatMsg[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!imei && maquinas.length > 0) setImei(maquinas[0].mac_address);
  }, [maquinas, imei]);

  // Intervenciones humanas en tiempo real
  useEffect(() => {
    if (!conversationId) return;
    const channel = almaClient
      .channel(`alma-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, any>;
          if (!row?.content) return;
          setMensajes((prev) => {
            if (prev.some((m) => m.id === String(row.id))) return prev;
            if (!row.es_intervencion) return prev;
            return [
              ...prev,
              {
                id: String(row.id),
                autor: 'alma',
                texto: String(row.content),
                hora: nowTime(),
                nombreAutor: row.autor || row.author || 'Soporte Almalibre',
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      almaClient.removeChannel(channel);
    };
  }, [conversationId]);

  // Scroll dentro del contenedor (nunca mueve la página en iOS)
  const scrollAlFinal = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    requestAnimationFrame(() => scrollAlFinal());
  }, [mensajes, enviando, keyboardOpen]);

  const maquinaActual = useMemo(
    () => maquinas.find((m) => m.mac_address === imei),
    [maquinas, imei]
  );

  const autoGrow = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 240);
  };

  const enviar = async () => {
    const contenido = texto.trim();
    if (!contenido || enviando || !imei) return;

    setMensajes((prev) => [
      ...prev,
      { id: crypto.randomUUID(), autor: 'usuario', texto: contenido, hora: nowTime() },
    ]);
    setTexto('');
    requestAnimationFrame(autoGrow);
    setEnviando(true);

    try {
      const { data, error } = await supabase.functions.invoke('alma-chat', {
        body: { imei, mensaje: contenido },
      });

      const status = (error as any)?.context?.status;
      const notFound = status === 404 || (data as any)?.error === 'machine_not_found';

      if (notFound) {
        setMensajes((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            autor: 'error',
            texto:
              'No hemos podido identificar tu máquina con ese IMEI. Comprueba que esté bien registrada o contacta con soporte para que la revisemos.',
            hora: nowTime(),
          },
        ]);
      } else if (error || (data as any)?.error) {
        setMensajes((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            autor: 'error',
            texto:
              'Ahora mismo no puedo conectar con el servicio de soporte. Inténtalo de nuevo en unos segundos.',
            hora: nowTime(),
          },
        ]);
      } else {
        const convId =
          (data as any)?.conversationId ?? (data as any)?.conversation_id ?? (data as any)?.conversation?.id;
        if (convId) setConversationId(String(convId));
        setMensajes((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            autor: 'alma',
            texto: (data as any)?.respuesta ?? 'He recibido tu mensaje.',
            hora: nowTime(),
          },
        ]);
      }
    } catch {
      setMensajes((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          autor: 'error',
          texto: 'Ha ocurrido un problema de conexión. Inténtalo de nuevo.',
          hora: nowTime(),
        },
      ]);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="fixed inset-x-0 flex flex-col overflow-hidden bg-secondary touch-pan-y overscroll-none"
      style={{
        top: `${offsetTop}px`,
        height: height ? `${height}px` : '100dvh',
        maxWidth: '100vw',
      }}
    >
      {/* Header estilo WhatsApp — siempre visible */}
      <header className="shrink-0 bg-primary text-primary-foreground shadow-lg safe-area-top">
        <div className="flex items-center gap-2 h-14 px-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-primary-foreground/10 transition-colors"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-primary-foreground/15 ring-1 ring-primary-foreground/30 flex items-center justify-center">
              <Leaf className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success ring-2 ring-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-[15px] leading-tight truncate">Alma · Soporte 24/7</h1>
            <p className="text-[11px] text-primary-foreground/75 truncate">
              {enviando
                ? 'escribiendo…'
                : maquinaActual
                ? `en línea · ${maquinaActual.nombre_personalizado}`
                : 'en línea'}
            </p>
          </div>
        </div>

        {maquinas.length > 1 && (
          <div className="px-3 pb-2">
            <Select value={imei} onValueChange={setImei}>
              <SelectTrigger className="h-8 text-xs bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
                <SelectValue placeholder="Selecciona una máquina" />
              </SelectTrigger>
              <SelectContent>
                {maquinas.map((m) => (
                  <SelectItem key={m.id} value={m.mac_address}>
                    {m.nombre_personalizado}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      {/* Zona de mensajes con "wallpaper" de marca */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]"
        style={{
          backgroundImage:
            'radial-gradient(hsl(var(--primary) / 0.07) 1px, transparent 1px), radial-gradient(hsl(var(--primary) / 0.05) 1px, transparent 1px)',
          backgroundSize: '28px 28px, 28px 28px',
          backgroundPosition: '0 0, 14px 14px',
        }}
      >
        <div className="mx-auto w-full max-w-2xl px-3 py-3 space-y-2">
          {loadingMaquinas ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-3/4 rounded-2xl" />
              <Skeleton className="h-12 w-2/3 rounded-2xl ml-auto" />
              <Skeleton className="h-20 w-4/5 rounded-2xl" />
            </div>
          ) : maquinas.length === 0 ? (
            <Card className="mt-6">
              <CardContent className="py-10 text-center space-y-3">
                <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Todavía no tienes ninguna máquina registrada. Añade una para poder chatear con Alma.
                </p>
                <Button size="sm" onClick={() => navigate('/add-machine')}>
                  Añadir máquina
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex justify-center py-1">
                <span className="text-[10px] uppercase tracking-wide bg-card/80 backdrop-blur px-3 py-1 rounded-full text-muted-foreground shadow-sm">
                  Hoy
                </span>
              </div>

              {mensajes.length === 0 && (
                <div className="space-y-3 animate-fade-in">
                  <div className="flex gap-2 items-end">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 shadow">
                      <Leaf className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                    <div className="relative max-w-[82%] rounded-2xl rounded-bl-md bg-card px-3.5 py-2.5 shadow-sm">
                      <p className="text-[14px] leading-relaxed">
                        ¡Hola {profile?.nombre?.split(' ')[0] || ''}! Soy{' '}
                        <span className="font-semibold text-primary">Alma</span>, tu asistente de
                        soporte. Cuéntame qué le pasa a tu máquina y lo resolvemos juntos. 🍃
                      </p>
                      <p className="text-[10px] mt-1 text-muted-foreground text-right">{nowTime()}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-9">
                    {SUGERENCIAS.map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setTexto(s);
                          inputRef.current?.focus();
                        }}
                        className="text-xs px-3 py-1.5 rounded-full bg-card border border-primary/20 text-primary shadow-sm active:scale-95 transition-transform"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mensajes.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'flex gap-2 items-end animate-fade-in',
                    m.autor === 'usuario' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {m.autor !== 'usuario' && (
                    <div
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow',
                        m.autor === 'error' ? 'bg-destructive' : 'bg-primary'
                      )}
                    >
                      {m.autor === 'error' ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive-foreground" />
                      ) : (
                        <Leaf className="h-3.5 w-3.5 text-primary-foreground" />
                      )}
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[82%] px-3.5 py-2.5 shadow-sm rounded-2xl',
                      m.autor === 'usuario'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : m.autor === 'error'
                        ? 'bg-destructive/10 text-foreground border border-destructive/30 rounded-bl-md'
                        : m.nombreAutor
                        ? 'bg-warning/15 border border-warning/40 rounded-bl-md'
                        : 'bg-card rounded-bl-md'
                    )}
                  >
                    {m.nombreAutor && (
                      <p className="text-[11px] font-semibold text-primary mb-0.5">
                        {m.nombreAutor} (Soporte Almalibre)
                      </p>
                    )}
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                      {m.texto}
                    </p>
                    <p
                      className={cn(
                        'text-[10px] mt-1 text-right',
                        m.autor === 'usuario'
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                      )}
                    >
                      {m.hora}
                    </p>
                  </div>
                  {m.autor === 'usuario' && (
                    <div className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center shrink-0">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {enviando && (
                <div className="flex gap-2 items-end animate-fade-in">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 shadow">
                    <Leaf className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                  <div className="bg-card rounded-2xl rounded-bl-md px-4 py-3 shadow-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={endRef} />
        </div>

        {showScrollDown && (
          <button
            onClick={() => scrollAlFinal()}
            className="sticky bottom-3 ml-auto mr-3 flex w-9 h-9 items-center justify-center rounded-full bg-card shadow-lg border border-border text-primary"
            aria-label="Ir al final"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Composer: parte del flujo, nunca tapado por el teclado */}
      <div
        className="shrink-0 bg-background/95 backdrop-blur border-t border-border px-2 pt-2 overflow-x-hidden"
        style={{
          paddingBottom: keyboardOpen ? '0.5rem' : 'calc(0.5rem + env(safe-area-inset-bottom))',
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
          className="mx-auto flex w-full max-w-2xl items-end gap-2"
        >
          <div className="min-w-0 flex-1 flex items-end rounded-3xl bg-secondary border border-border px-4 py-2">
            <textarea
              ref={inputRef}
              rows={1}
              placeholder="Escribe un mensaje…"
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                autoGrow();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              disabled={enviando || maquinas.length === 0}
              className="w-full resize-none bg-transparent text-base leading-6 outline-none placeholder:text-muted-foreground max-h-[120px]"
            />
          </div>
          <button
            type="submit"
            disabled={!texto.trim() || enviando || maquinas.length === 0}
            className="h-11 w-11 shrink-0 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
            aria-label="Enviar"
          >
            {enviando ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </form>
      </div>

    </div>
  );
};
