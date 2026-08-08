import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { ArrowLeft, Send, Loader2, Headphones, User, AlertTriangle, Leaf } from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ChatMsg {
  id: string;
  autor: 'usuario' | 'alma' | 'error';
  texto: string;
  hora: string;
}

const nowTime = () =>
  new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

const SUGERENCIAS = [
  'La máquina no dispensa açaí',
  'Error en pantalla',
  'No acepta pagos con tarjeta',
  'Temperatura fuera de rango',
];

export const SoporteAlma = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { maquinas, loading: loadingMaquinas } = useMaquinas(user?.id);

  const [imei, setImei] = useState<string>('');
  const [mensajes, setMensajes] = useState<ChatMsg[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!imei && maquinas.length > 0) setImei(maquinas[0].mac_address);
  }, [maquinas, imei]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes, enviando]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const maquinaActual = useMemo(
    () => maquinas.find((m) => m.mac_address === imei),
    [maquinas, imei]
  );

  const enviar = async () => {
    const contenido = texto.trim();
    if (!contenido || enviando || !imei) return;

    setMensajes((prev) => [
      ...prev,
      { id: crypto.randomUUID(), autor: 'usuario', texto: contenido, hora: nowTime() },
    ]);
    setTexto('');
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
      inputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center gap-3 h-16 px-3 sm:px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
            <Headphones className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm sm:text-base truncate">Alma · Soporte 24/7</h1>
            <p className="text-xs text-muted-foreground truncate">
              {maquinaActual ? maquinaActual.nombre_personalizado : 'Almalibre Franquicias'}
            </p>
          </div>
        </div>

        {maquinas.length > 1 && (
          <div className="container px-3 sm:px-4 pb-3">
            <Select value={imei} onValueChange={setImei}>
              <SelectTrigger className="h-9 text-sm">
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

      <main className="flex-1 overflow-y-auto pb-44">
        <div className="container max-w-2xl px-3 sm:px-4 py-4 space-y-3">

          {loadingMaquinas ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-3/4 rounded-2xl" />
              <Skeleton className="h-14 w-2/3 rounded-2xl ml-auto" />
            </div>
          ) : maquinas.length === 0 ? (
            <Card>
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
              {mensajes.length === 0 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Leaf className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
                      <p className="text-sm">
                        ¡Hola {profile?.nombre?.split(' ')[0] || ''}! Soy <span className="font-semibold">Alma</span>,
                        tu asistente de soporte. Cuéntame qué le pasa a tu máquina y lo resolvemos juntos. 🍃
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-10">
                    {SUGERENCIAS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setTexto(s)}
                        className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
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
                    'flex gap-2 animate-fade-in',
                    m.autor === 'usuario' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {m.autor !== 'usuario' && (
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                        m.autor === 'error' ? 'bg-destructive' : 'bg-primary'
                      )}
                    >
                      {m.autor === 'error' ? (
                        <AlertTriangle className="h-4 w-4 text-destructive-foreground" />
                      ) : (
                        <Leaf className="h-4 w-4 text-primary-foreground" />
                      )}
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-2.5',
                      m.autor === 'usuario'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : m.autor === 'error'
                        ? 'bg-destructive/10 text-foreground border border-destructive/30 rounded-bl-sm'
                        : 'bg-muted rounded-bl-sm'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{m.texto}</p>
                    <p
                      className={cn(
                        'text-[10px] mt-1',
                        m.autor === 'usuario' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}
                    >
                      {m.hora}
                    </p>
                  </div>
                  {m.autor === 'usuario' && (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {enviando && (
                <div className="flex gap-2 animate-fade-in">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Leaf className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                    </span>
                    <span className="text-xs text-muted-foreground">Alma está escribiendo…</span>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={endRef} />
        </div>
      </main>

      <div className="fixed bottom-16 left-0 right-0 bg-background border-t p-3 safe-area-bottom">
        <div className="container px-1">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              placeholder="Escribe tu mensaje a Alma…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={enviando || maquinas.length === 0}
              className="flex-1 rounded-full"
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-full shrink-0"
              disabled={!texto.trim() || enviando || maquinas.length === 0}
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};
