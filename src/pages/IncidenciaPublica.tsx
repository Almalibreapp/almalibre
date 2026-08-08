import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  ArrowRight,
  CheckCircle2,
  ImagePlus,
  Loader2,
  MapPin,
  QrCode,
  Send,
  X,
} from 'lucide-react';
import logoWhite from '@/assets/logo-almalibre-white.png';
import logoIcon from '@/assets/logo-icon-almalibre.png';

type Paso = 'bienvenida' | 'contacto' | 'chat';

type Mensaje = {
  id: string;
  autor: 'alma' | 'cliente';
  texto: string;
  imagenUrl?: string | null;
  ticket?: string | null;
};

const emailValido = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());
const telefonoValido = (v: string) => v.replace(/\D/g, '').length >= 8;

const extraerTicket = (texto: string): string | null => {
  const m = texto.match(/\b((?:INC|TCK|TKT|ALM)[-\s]?\d{2,4}[-\s]?\d{2,6})\b/i);
  return m ? m[1].replace(/\s+/g, '-').toUpperCase() : null;
};

const Fondo = () => (
  <>
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary via-primary to-[hsl(290_60%_18%)]" />
    <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary-glow/25 blur-3xl animate-pulse-slow" />
    <div className="pointer-events-none absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-primary-glow/20 blur-3xl animate-float" />
  </>
);

export const IncidenciaPublica = () => {
  const [params] = useSearchParams();
  const imei = (params.get('imei') ?? '').trim();

  const [paso, setPaso] = useState<Paso>('bienvenida');
  const [cargando, setCargando] = useState(true);
  const [ubicacion, setUbicacion] = useState<string | null>(null);
  const [noEncontrada, setNoEncontrada] = useState(false);

  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');

  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [fotoPendiente, setFotoPendiente] = useState<{ url: string; preview: string } | null>(null);
  const [ticketFinal, setTicketFinal] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Paso 1 — identificar máquina
  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      if (!imei) {
        if (activo) {
          setNoEncontrada(true);
          setCargando(false);
        }
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke('incidencia-info', {
          body: { imei },
        });
        if (!activo) return;
        if (error || (data as any)?.error) {
          setNoEncontrada(true);
        } else {
          const d = data as any;
          setUbicacion(
            d?.ubicacion || d?.localizacion || d?.nombre || d?.maquina?.ubicacion || null
          );
        }
      } catch {
        if (activo) setNoEncontrada(true);
      } finally {
        if (activo) setCargando(false);
      }
    };
    cargar();
    return () => {
      activo = false;
    };
  }, [imei]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [mensajes.length, enviando]);

  const contactoValido = useMemo(
    () => nombre.trim().length >= 2 && telefonoValido(whatsapp) && emailValido(email),
    [nombre, whatsapp, email]
  );

  const irAlChat = () => {
    setPaso('chat');
    setMensajes([
      {
        id: 'saludo',
        autor: 'alma',
        texto: `Hola ${nombre.trim().split(' ')[0]}, soy Alma 💜 Siento mucho lo ocurrido. Cuéntame con tus palabras qué ha pasado con tu pedido y lo solucionamos enseguida. Si quieres, puedes adjuntar una foto.`,
      },
    ]);
  };

  const subirFoto = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Formato no válido', description: 'Elige una imagen, por favor.', variant: 'destructive' });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: 'Imagen demasiado grande', description: 'Prueba con una foto de menos de 8 MB.', variant: 'destructive' });
      return;
    }
    setSubiendo(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const ruta = `${imei || 'sin-imei'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('incidencias-clientes')
        .upload(ruta, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const { data: firmada, error: signErr } = await supabase.storage
        .from('incidencias-clientes')
        .createSignedUrl(ruta, 60 * 60 * 24 * 365);
      if (signErr || !firmada?.signedUrl) throw signErr ?? new Error('sin_url');
      setFotoPendiente({ url: firmada.signedUrl, preview: URL.createObjectURL(file) });
    } catch {
      toast({
        title: 'No pudimos subir la foto',
        description: 'Inténtalo otra vez o envíanos solo el mensaje.',
        variant: 'destructive',
      });
    } finally {
      setSubiendo(false);
    }
  }, [imei]);

  const enviarMensaje = async () => {
    const mensaje = texto.trim();
    if ((!mensaje && !fotoPendiente) || enviando) return;
    const foto = fotoPendiente;
    const localId = `c-${Date.now()}`;

    setMensajes((prev) => [
      ...prev,
      { id: localId, autor: 'cliente', texto: mensaje, imagenUrl: foto?.preview ?? null },
    ]);
    setTexto('');
    setFotoPendiente(null);
    setEnviando(true);

    try {
      const { data, error } = await supabase.functions.invoke('incidencia-web', {
        body: {
          imei,
          nombre: nombre.trim(),
          whatsapp: whatsapp.trim(),
          email: email.trim(),
          mensaje: mensaje || 'He adjuntado una foto del problema.',
          imagenUrl: foto?.url ?? null,
        },
      });
      if (error || (data as any)?.error) throw new Error('fallo');

      const d = data as any;
      const respuesta =
        d?.respuesta || d?.mensaje || d?.reply || d?.texto || 'Gracias, ya estamos revisándolo.';
      const ticket = d?.numeroTicket || d?.numero_ticket || d?.ticket || extraerTicket(String(respuesta));

      if (ticket) setTicketFinal(String(ticket));
      setMensajes((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, autor: 'alma', texto: String(respuesta), ticket: ticket ? String(ticket) : null },
      ]);
    } catch {
      setMensajes((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          autor: 'alma',
          texto: 'Ups, no he podido recibir tu mensaje ahora mismo. ¿Puedes intentarlo de nuevo en unos segundos?',
        },
      ]);
    } finally {
      setEnviando(false);
    }
  };

  /* ------------------------------ pantallas ------------------------------ */

  const cabecera = (
    <div className="flex items-center justify-center pt-8 pb-4 shrink-0">
      <img src={logoWhite} alt="Almalibre" className="h-8 w-auto" />
    </div>
  );

  if (cargando) {
    return (
      <main className="relative min-h-[100dvh] overflow-hidden">
        <Fondo />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-[100dvh] gap-6 px-6">
          <img src={logoIcon} alt="" className="h-16 w-16 animate-splash-bounce" />
          <div className="w-full max-w-sm space-y-3">
            <Skeleton className="h-4 w-2/3 mx-auto bg-primary-foreground/20" />
            <Skeleton className="h-4 w-1/2 mx-auto bg-primary-foreground/20" />
          </div>
        </div>
      </main>
    );
  }

  if (noEncontrada) {
    return (
      <main className="relative min-h-[100dvh] overflow-hidden">
        <Fondo />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-[100dvh] px-6 text-center text-primary-foreground animate-fade-in-up">
          <div className="h-20 w-20 rounded-3xl bg-primary-foreground/10 flex items-center justify-center mb-6">
            <QrCode className="h-9 w-9" />
          </div>
          <h1 className="font-display text-2xl font-bold mb-3">No hemos reconocido esta máquina</h1>
          <p className="text-primary-foreground/80 max-w-sm leading-relaxed">
            Puede que el código se haya leído mal. Vuelve a escanear el QR de la máquina y estaremos
            encantados de ayudarte.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden">
      <Fondo />
      <div className="relative z-10 flex flex-col min-h-[100dvh] safe-area-top safe-area-bottom">
        {cabecera}

        {/* PASO 1 — bienvenida */}
        {paso === 'bienvenida' && (
          <section className="flex-1 flex flex-col items-center justify-center px-6 text-center text-primary-foreground animate-fade-in-up">
            <img src={logoIcon} alt="" className="h-20 w-20 mb-6 animate-splash-logo" />
            <h1 className="font-display text-[26px] leading-tight font-bold max-w-sm">
              Hola, vemos que tuviste un problema
            </h1>
            {ubicacion && (
              <p className="mt-3 inline-flex items-center gap-2 text-sm bg-primary-foreground/10 rounded-full px-4 py-1.5">
                <MapPin className="h-4 w-4" />
                {ubicacion}
              </p>
            )}
            <p className="mt-4 text-primary-foreground/85 max-w-sm leading-relaxed">
              Sentimos que tu experiencia no haya sido perfecta. Vamos a ayudarte, solo nos llevará
              un minuto.
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="mt-8 rounded-2xl h-12 px-8 font-semibold shadow-lg"
              onClick={() => setPaso('contacto')}
            >
              Empezar
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </section>
        )}

        {/* PASO 2 — contacto */}
        {paso === 'contacto' && (
          <section className="flex-1 flex flex-col justify-end sm:justify-center px-4 pb-4 animate-fade-in">
            <div className="w-full max-w-md mx-auto rounded-3xl bg-card p-6 shadow-2xl animate-slide-up">
              <h2 className="font-display text-xl font-bold text-foreground">¿Cómo te localizamos?</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-5">
                Solo lo usaremos para contarte cómo avanza tu incidencia.
              </p>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Tu nombre"
                    className="h-12 rounded-xl text-base"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+34 600 000 000"
                    inputMode="tel"
                    className="h-12 rounded-xl text-base"
                    autoComplete="tel"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tucorreo@email.com"
                    inputMode="email"
                    className="h-12 rounded-xl text-base"
                    autoComplete="email"
                  />
                  {email.length > 0 && !emailValido(email) && (
                    <p className="text-xs text-destructive">Revisa que el email sea correcto.</p>
                  )}
                </div>
              </div>

              <Button
                className="w-full mt-6 h-12 rounded-2xl font-semibold"
                disabled={!contactoValido}
                onClick={irAlChat}
              >
                Continuar
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </section>
        )}

        {/* PASO 3 y 4 — chat */}
        {paso === 'chat' && (
          <section className="flex-1 min-h-0 flex flex-col px-2 pb-2 animate-fade-in">
            <div className="flex-1 min-h-0 flex flex-col w-full max-w-md mx-auto rounded-3xl bg-card overflow-hidden shadow-2xl">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
                <img src={logoIcon} alt="" className="h-9 w-9 rounded-full" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Alma</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {ubicacion ? `Máquina de ${ubicacion}` : 'Atención al cliente'}
                  </p>
                </div>
              </div>

              <div
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-2.5 bg-secondary"
              >
                {mensajes.map((m) => (
                  <div key={m.id} className="space-y-2">
                    <div className={cn('flex', m.autor === 'cliente' ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[85%] px-3.5 py-2 rounded-2xl text-sm shadow-sm animate-slide-up',
                          m.autor === 'cliente'
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-card text-card-foreground rounded-bl-md'
                        )}
                      >
                        {m.imagenUrl && (
                          <img
                            src={m.imagenUrl}
                            alt="Foto adjunta de la incidencia"
                            className="rounded-xl mb-2 max-h-52 w-full object-cover"
                            loading="lazy"
                          />
                        )}
                        {m.texto && <p className="whitespace-pre-wrap break-words leading-relaxed">{m.texto}</p>}
                      </div>
                    </div>

                    {m.ticket && (
                      <div className="rounded-2xl border border-success/40 bg-success-light p-4 text-center animate-fade-in-up">
                        <CheckCircle2 className="h-7 w-7 text-success mx-auto" />
                        <p className="font-display text-2xl font-bold text-foreground mt-2 tracking-wide">
                          {m.ticket}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                          Tu incidencia ha sido registrada. Te avisaremos por email en cuanto tengamos
                          novedades.
                        </p>
                      </div>
                    )}
                  </div>
                ))}

                {enviando && (
                  <div className="flex justify-start">
                    <div className="bg-card rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-sm flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-pulse" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-pulse [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/70 animate-pulse [animation-delay:300ms]" />
                      <span className="text-xs text-muted-foreground ml-1">Alma está escribiendo…</span>
                    </div>
                  </div>
                )}
              </div>

              {fotoPendiente && (
                <div className="px-3 pt-2 shrink-0">
                  <div className="relative inline-block">
                    <img
                      src={fotoPendiente.preview}
                      alt="Vista previa de la foto"
                      className="h-16 w-16 rounded-xl object-cover border border-border"
                    />
                    <button
                      onClick={() => setFotoPendiente(null)}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                      aria-label="Quitar foto"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  enviarMensaje();
                }}
                className="border-t border-border p-2.5 flex items-end gap-2 shrink-0 bg-background"
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) subirFoto(f);
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 rounded-full shrink-0"
                  onClick={() => fileRef.current?.click()}
                  disabled={subiendo}
                  aria-label="Adjuntar una foto"
                >
                  {subiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                </Button>
                <Textarea
                  rows={1}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Cuéntanos qué ha pasado…"
                  className="resize-none rounded-2xl text-base min-h-[44px] max-h-28 flex-1"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-11 w-11 rounded-full shrink-0"
                  disabled={(!texto.trim() && !fotoPendiente) || enviando}
                  aria-label="Enviar mensaje"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>

            {ticketFinal && (
              <p className="text-center text-[11px] text-primary-foreground/70 mt-2">
                Incidencia {ticketFinal} · puedes seguir escribiendo si quieres añadir algo más
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
};

export default IncidenciaPublica;
