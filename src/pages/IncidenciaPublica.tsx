import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  ArrowRight,
  Camera,
  Check,
  CheckCheck,
  CheckCircle2,
  Loader2,
  MapPin,
  QrCode,
  Send,
  X,
} from 'lucide-react';
import logoIcon from '@/assets/logo-icon-almalibre.png';

type Paso = 'bienvenida' | 'contacto' | 'chat';
type Idioma = 'es' | 'en';

type Mensaje = {
  id: string;
  autor: 'alma' | 'cliente';
  texto: string;
  imagenUrl?: string | null;
  ticket?: string | null;
  entregado?: boolean;
};

const PREFIJOS = [
  { code: '+34', flag: '🇪🇸', name: 'España' },
  { code: '+1', flag: '🇺🇸', name: 'EE.UU. / Canadá' },
  { code: '+44', flag: '🇬🇧', name: 'Reino Unido' },
  { code: '+33', flag: '🇫🇷', name: 'Francia' },
  { code: '+49', flag: '🇩🇪', name: 'Alemania' },
  { code: '+39', flag: '🇮🇹', name: 'Italia' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: '+31', flag: '🇳🇱', name: 'Países Bajos' },
  { code: '+32', flag: '🇧🇪', name: 'Bélgica' },
  { code: '+41', flag: '🇨🇭', name: 'Suiza' },
  { code: '+353', flag: '🇮🇪', name: 'Irlanda' },
  { code: '+52', flag: '🇲🇽', name: 'México' },
  { code: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: '+55', flag: '🇧🇷', name: 'Brasil' },
  { code: '+56', flag: '🇨🇱', name: 'Chile' },
  { code: '+57', flag: '🇨🇴', name: 'Colombia' },
  { code: '+58', flag: '🇻🇪', name: 'Venezuela' },
  { code: '+212', flag: '🇲🇦', name: 'Marruecos' },
  { code: '+377', flag: '🇲🇨', name: 'Mónaco' },
  { code: '+376', flag: '🇦🇩', name: 'Andorra' },
];

const T = {
  es: {
    empezar: 'Empezar',
    continuar: 'Continuar',
    saludoTitulo: 'Hola, vemos que tuviste un problema',
    saludoTexto:
      'Sentimos que tu experiencia no haya sido perfecta. Vamos a ayudarte, solo nos llevará un minuto.',
    noMaquinaTitulo: 'No hemos reconocido esta máquina',
    noMaquinaTexto:
      'Puede que el código se haya leído mal. Vuelve a escanear el QR de la máquina y estaremos encantados de ayudarte.',
    idioma: 'Idioma',
    contactoTitulo: '¿Cómo te localizamos?',
    contactoTexto: 'Solo lo usaremos para contarte cómo avanza tu incidencia.',
    nombre: 'Nombre',
    nombrePh: 'Tu nombre',
    whatsapp: 'WhatsApp',
    whatsappPh: '600 000 000',
    email: 'Email',
    emailPh: 'tucorreo@email.com',
    emailError: 'Revisa que el email sea correcto.',
    atencion: 'Atención al cliente',
    maquinaDe: (u: string) => `Máquina de ${u}`,
    escribiendo: 'Alma está escribiendo…',
    placeholderChat: 'Cuéntanos qué ha pasado…',
    adjuntar: 'Adjuntar foto',
    quitarFoto: 'Quitar foto',
    enviar: 'Enviar mensaje',
    saludoChat: (n: string) =>
      `Hola ${n}, soy Alma 💜 Siento mucho lo ocurrido. Cuéntame con tus palabras qué ha pasado con tu pedido y lo solucionamos enseguida. Si quieres, puedes adjuntar una foto.`,
    chips: ['No salió el producto', 'Problema con el cobro', 'La máquina no responde', 'Otro'],
    conFoto: 'He adjuntado una foto del problema.',
    fallback: 'Gracias, ya estamos revisándolo.',
    errorEnvio: 'Ups, no he podido recibir tu mensaje ahora mismo. ¿Puedes intentarlo de nuevo en unos segundos?',
    ticketTexto: 'Tu incidencia ha sido registrada. Te avisaremos por email en cuanto tengamos novedades.',
    pieTicket: (t: string) => `Incidencia ${t} · puedes seguir escribiendo si quieres añadir algo más`,
    fotoFormato: 'Formato no válido',
    fotoFormatoDesc: 'Elige una imagen, por favor.',
    fotoGrande: 'Imagen demasiado grande',
    fotoGrandeDesc: 'Prueba con una foto de menos de 8 MB.',
    fotoError: 'No pudimos subir la foto',
    fotoErrorDesc: 'Inténtalo otra vez o envíanos solo el mensaje.',
  },
  en: {
    empezar: 'Get started',
    continuar: 'Continue',
    saludoTitulo: 'Hi, we see you had a problem',
    saludoTexto: "We're sorry your experience wasn't perfect. We'll help you, it only takes a minute.",
    noMaquinaTitulo: "We couldn't recognise this machine",
    noMaquinaTexto:
      'The code may have been misread. Please scan the machine QR again and we will be happy to help you.',
    idioma: 'Language',
    contactoTitulo: 'How can we reach you?',
    contactoTexto: "We'll only use this to keep you posted about your report.",
    nombre: 'Name',
    nombrePh: 'Your name',
    whatsapp: 'WhatsApp',
    whatsappPh: '600 000 000',
    email: 'Email',
    emailPh: 'you@email.com',
    emailError: 'Please check your email address.',
    atencion: 'Customer care',
    maquinaDe: (u: string) => `Machine at ${u}`,
    escribiendo: 'Alma is typing…',
    placeholderChat: 'Tell us what happened…',
    adjuntar: 'Attach photo',
    quitarFoto: 'Remove photo',
    enviar: 'Send message',
    saludoChat: (n: string) =>
      `Hi ${n}, I'm Alma 💜 I'm really sorry about that. Tell me in your own words what happened with your order and we'll sort it out right away. You can attach a photo if you like.`,
    chips: ['The product never came out', 'Payment issue', "The machine doesn't respond", 'Other'],
    conFoto: 'I have attached a photo of the problem.',
    fallback: "Thanks, we're already looking into it.",
    errorEnvio: "Oops, I couldn't receive your message right now. Could you try again in a few seconds?",
    ticketTexto: "Your report has been registered. We'll email you as soon as we have news.",
    pieTicket: (t: string) => `Report ${t} · you can keep writing if you want to add anything else`,
    fotoFormato: 'Invalid format',
    fotoFormatoDesc: 'Please choose an image.',
    fotoGrande: 'Image too large',
    fotoGrandeDesc: 'Try a photo under 8 MB.',
    fotoError: "We couldn't upload the photo",
    fotoErrorDesc: 'Try again or just send us the message.',
  },
} as const;

const emailValido = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());
const telefonoValido = (v: string) => v.replace(/\D/g, '').length >= 6;

const extraerTicket = (texto: string): string | null => {
  const m = texto.match(/\b((?:INC|TCK|TKT|TK|ALM)[-\s]?\d{2,4}[-\s]?\d{2,6})\b/i);
  return m ? m[1].replace(/\s+/g, '-').toUpperCase() : null;
};

const Fondo = () => (
  <>
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary via-primary to-[hsl(290_60%_18%)]" />
    <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary-glow/25 blur-3xl animate-pulse-slow" />
    <div className="pointer-events-none absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-primary-glow/20 blur-3xl animate-float" />
  </>
);

// Logo de marca forzado a blanco puro
const LogoBlanco = ({ className }: { className?: string }) => (
  <img src={logoIcon} alt="Almalibre" className={cn('brightness-0 invert', className)} />
);

export const IncidenciaPublica = () => {
  const [params] = useSearchParams();
  const imei = (params.get('imei') ?? '').trim();

  const [idioma, setIdioma] = useState<Idioma>('es');
  const t = T[idioma];

  const [paso, setPaso] = useState<Paso>('bienvenida');
  const [cargando, setCargando] = useState(true);
  const [ubicacion, setUbicacion] = useState<string | null>(null);
  const [noEncontrada, setNoEncontrada] = useState(false);

  const [nombre, setNombre] = useState('');
  const [prefijo, setPrefijo] = useState('+34');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');

  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [fotoPendiente, setFotoPendiente] = useState<{ url: string; preview: string } | null>(null);
  const [ticketFinal, setTicketFinal] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const whatsappCompleto = `${prefijo}${telefono.replace(/\D/g, '')}`;

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
        const { data, error } = await supabase.functions.invoke('incidencia-info', { body: { imei } });
        if (!activo) return;
        if (error || (data as any)?.error) {
          setNoEncontrada(true);
        } else {
          const d = data as any;
          setUbicacion(d?.ubicacion || d?.localizacion || d?.nombre || d?.maquina?.ubicacion || null);
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
  }, [mensajes.length, enviando, fotoPendiente]);

  const contactoValido = useMemo(
    () => nombre.trim().length >= 2 && telefonoValido(telefono) && emailValido(email),
    [nombre, telefono, email]
  );

  const irAlChat = () => {
    setPaso('chat');
    setMensajes([
      { id: 'saludo', autor: 'alma', texto: t.saludoChat(nombre.trim().split(' ')[0]) },
    ]);
  };

  const subirFoto = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: t.fotoFormato, description: t.fotoFormatoDesc, variant: 'destructive' });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: t.fotoGrande, description: t.fotoGrandeDesc, variant: 'destructive' });
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
      toast({ title: t.fotoError, description: t.fotoErrorDesc, variant: 'destructive' });
    } finally {
      setSubiendo(false);
    }
  }, [imei, t]);

  const enviarMensaje = async (textoForzado?: string) => {
    const mensaje = (textoForzado ?? texto).trim();
    if ((!mensaje && !fotoPendiente) || enviando) return;
    const foto = fotoPendiente;
    const localId = `c-${Date.now()}`;

    setMensajes((prev) => [
      ...prev,
      { id: localId, autor: 'cliente', texto: mensaje, imagenUrl: foto?.preview ?? null, entregado: false },
    ]);
    setTexto('');
    setFotoPendiente(null);
    setEnviando(true);

    try {
      const { data, error } = await supabase.functions.invoke('incidencia-web', {
        body: {
          imei,
          nombre: nombre.trim(),
          whatsapp: whatsappCompleto,
          email: email.trim(),
          mensaje: mensaje || t.conFoto,
          imagenUrl: foto?.url ?? null,
          idioma,
        },
      });
      if (error || (data as any)?.error) throw new Error('fallo');

      const d = data as any;
      const respuesta = d?.respuesta || d?.mensaje || d?.reply || d?.texto || t.fallback;
      const ticket = d?.numeroTicket || d?.numero_ticket || d?.ticket || extraerTicket(String(respuesta));

      if (ticket) setTicketFinal(String(ticket));
      setMensajes((prev) => [
        ...prev.map((m) => (m.id === localId ? { ...m, entregado: true } : m)),
        {
          id: `a-${Date.now()}`,
          autor: 'alma',
          texto: String(respuesta),
          ticket: ticket ? String(ticket) : null,
        },
      ]);
    } catch {
      setMensajes((prev) => [...prev, { id: `e-${Date.now()}`, autor: 'alma', texto: t.errorEnvio }]);
    } finally {
      setEnviando(false);
    }
  };

  const selectorIdioma = (
    <div className="inline-flex rounded-full bg-primary-foreground/10 p-1 backdrop-blur">
      {(['es', 'en'] as Idioma[]).map((l) => (
        <button
          key={l}
          onClick={() => setIdioma(l)}
          className={cn(
            'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
            idioma === l
              ? 'bg-primary-foreground text-primary shadow-sm'
              : 'text-primary-foreground/80'
          )}
        >
          {l === 'es' ? '🇪🇸 Español' : '🇬🇧 English'}
        </button>
      ))}
    </div>
  );

  const cabecera = (
    <div className="flex items-center justify-center pt-8 pb-4 shrink-0">
      <LogoBlanco className="h-10 w-auto" />
    </div>
  );

  if (cargando) {
    return (
      <main className="relative min-h-[100dvh] overflow-hidden">
        <Fondo />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-[100dvh] gap-6 px-6">
          <LogoBlanco className="h-16 w-16 animate-splash-bounce" />
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
          <h1 className="font-display text-2xl font-bold mb-3">{t.noMaquinaTitulo}</h1>
          <p className="text-primary-foreground/80 max-w-sm leading-relaxed">{t.noMaquinaTexto}</p>
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
            <LogoBlanco className="h-20 w-20 mb-6 animate-splash-logo" />
            <h1 className="font-display text-[26px] leading-tight font-bold max-w-sm">{t.saludoTitulo}</h1>
            {ubicacion && (
              <p className="mt-3 inline-flex items-center gap-2 text-sm bg-primary-foreground/10 rounded-full px-4 py-1.5">
                <MapPin className="h-4 w-4" />
                {ubicacion}
              </p>
            )}
            <p className="mt-4 text-primary-foreground/85 max-w-sm leading-relaxed">{t.saludoTexto}</p>

            <div className="mt-7">{selectorIdioma}</div>

            <Button
              size="lg"
              variant="secondary"
              className="mt-6 rounded-2xl h-12 px-8 font-semibold shadow-lg"
              onClick={() => setPaso('contacto')}
            >
              {t.empezar}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </section>
        )}

        {/* PASO 2 — contacto */}
        {paso === 'contacto' && (
          <section className="flex-1 flex flex-col justify-end sm:justify-center px-4 pb-4 animate-fade-in">
            <div className="w-full max-w-md mx-auto rounded-3xl bg-card p-6 shadow-2xl animate-slide-up">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="font-display text-xl font-bold text-foreground">{t.contactoTitulo}</h2>
                <div className="inline-flex rounded-full bg-muted p-0.5">
                  {(['es', 'en'] as Idioma[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => setIdioma(l)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                        idioma === l ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                      )}
                    >
                      {l === 'es' ? '🇪🇸 ES' : '🇬🇧 EN'}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted-foreground -mt-2 mb-5">{t.contactoTexto}</p>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="nombre">{t.nombre}</Label>
                  <Input
                    id="nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder={t.nombrePh}
                    className="h-12 rounded-xl text-base"
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="whatsapp">{t.whatsapp}</Label>
                  <div className="flex gap-2">
                    <Select value={prefijo} onValueChange={setPrefijo}>
                      <SelectTrigger className="h-12 w-[124px] rounded-xl text-base shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {PREFIJOS.map((p) => (
                          <SelectItem key={p.code + p.name} value={p.code}>
                            {p.flag} {p.code} · {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="whatsapp"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value.replace(/[^\d\s]/g, ''))}
                      placeholder={t.whatsappPh}
                      inputMode="tel"
                      className="h-12 rounded-xl text-base flex-1"
                      autoComplete="tel-national"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">{t.email}</Label>
                  <Input
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.emailPh}
                    inputMode="email"
                    className="h-12 rounded-xl text-base"
                    autoComplete="email"
                  />
                  {email.length > 0 && !emailValido(email) && (
                    <p className="text-xs text-destructive">{t.emailError}</p>
                  )}
                </div>
              </div>

              <Button
                className="w-full mt-6 h-12 rounded-2xl font-semibold"
                disabled={!contactoValido}
                onClick={irAlChat}
              >
                {t.continuar}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </section>
        )}

        {/* PASO 3 y 4 — chat */}
        {paso === 'chat' && (
          <section className="flex-1 min-h-0 flex flex-col px-2 pb-2 animate-fade-in-up">
            <div className="flex-1 min-h-0 flex flex-col w-full max-w-md mx-auto rounded-3xl bg-card overflow-hidden shadow-2xl">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
                <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <LogoBlanco className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Alma</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {ubicacion ? t.maquinaDe(ubicacion) : t.atencion}
                  </p>
                </div>
              </div>

              <div
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3 bg-secondary"
              >
                {mensajes.map((m) => (
                  <div key={m.id} className="space-y-2">
                    <div className={cn('flex', m.autor === 'cliente' ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[88%] px-4 py-3 rounded-3xl text-[15px] leading-relaxed shadow-sm animate-slide-up',
                          m.autor === 'cliente'
                            ? 'bg-primary text-primary-foreground rounded-br-lg'
                            : 'bg-card text-card-foreground rounded-bl-lg'
                        )}
                      >
                        {m.imagenUrl && (
                          <img
                            src={m.imagenUrl}
                            alt="Foto adjunta de la incidencia"
                            className="rounded-2xl mb-2 max-h-56 w-full object-cover"
                            loading="lazy"
                          />
                        )}
                        {m.texto && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}
                        {m.autor === 'cliente' && (
                          <span className="flex justify-end mt-1 text-primary-foreground/70">
                            {m.entregado ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                          </span>
                        )}
                      </div>
                    </div>

                    {m.ticket && (
                      <div className="rounded-2xl border border-success/40 bg-success-light p-4 text-center animate-fade-in-up">
                        <CheckCircle2 className="h-7 w-7 text-success mx-auto" />
                        <p className="font-display text-2xl font-bold text-foreground mt-2 tracking-wide">
                          {m.ticket}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{t.ticketTexto}</p>
                      </div>
                    )}
                  </div>
                ))}

                {/* Chips de sugerencias */}
                {mensajes.length === 1 && !enviando && (
                  <div className="flex flex-wrap gap-2 pt-1 animate-fade-in">
                    {t.chips.map((c) => (
                      <button
                        key={c}
                        onClick={() => enviarMensaje(c)}
                        className="rounded-full border border-primary/30 bg-card px-4 py-2 text-sm font-medium text-primary shadow-sm active:scale-95 transition-transform"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}

                {enviando && (
                  <div className="flex justify-start">
                    <div className="bg-card rounded-3xl rounded-bl-lg px-4 py-3 shadow-sm flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/70 animate-pulse" />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/70 animate-pulse [animation-delay:150ms]" />
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/70 animate-pulse [animation-delay:300ms]" />
                      <span className="text-xs text-muted-foreground ml-1">{t.escribiendo}</span>
                    </div>
                  </div>
                )}
              </div>

              {fotoPendiente && (
                <div className="px-3 pt-2 shrink-0">
                  <div className="relative inline-block">
                    <img
                      src={fotoPendiente.preview}
                      alt="Vista previa"
                      className="h-20 w-20 rounded-2xl object-cover border border-border"
                    />
                    <button
                      onClick={() => setFotoPendiente(null)}
                      className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                      aria-label={t.quitarFoto}
                    >
                      <X className="h-4 w-4" />
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
                  size="icon"
                  className="min-h-[52px] min-w-[52px] rounded-2xl shrink-0 bg-primary/10 text-primary hover:bg-primary/20"
                  onClick={() => fileRef.current?.click()}
                  disabled={subiendo}
                  aria-label={t.adjuntar}
                >
                  {subiendo ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
                </Button>
                <Textarea
                  ref={textareaRef}
                  rows={1}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={t.placeholderChat}
                  className="resize-none rounded-2xl text-base min-h-[52px] max-h-32 flex-1 py-3.5"
                />
                <Button
                  type="submit"
                  size="icon"
                  className="min-h-[52px] min-w-[52px] rounded-2xl shrink-0"
                  disabled={(!texto.trim() && !fotoPendiente) || enviando}
                  aria-label={t.enviar}
                >
                  <Send className="h-5 w-5" />
                </Button>
              </form>
            </div>

            {ticketFinal && (
              <p className="text-center text-[11px] text-primary-foreground/70 mt-2">{t.pieTicket(ticketFinal)}</p>
            )}
          </section>
        )}
      </div>
    </main>
  );
};

export default IncidenciaPublica;
