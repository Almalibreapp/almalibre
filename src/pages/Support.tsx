import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Send, Loader2, MessageCircle, User, Headphones } from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';
import { cn } from '@/lib/utils';

interface Mensaje {
  id: string;
  mensaje: string;
  autor: string;
  created_at: string;
}

export const Support = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchMensajes();
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [mensajes]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMensajes = async () => {
    const { data, error } = await supabase
      .from('mensajes_soporte')
      .select('*')
      .eq('usuario_id', user?.id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMensajes(data);
    }
    setLoading(false);
  };

  const handleSend = async () => {
    if (!nuevoMensaje.trim() || !user) return;

    setSending(true);

    const { error } = await supabase.from('mensajes_soporte').insert({
      usuario_id: user.id,
      mensaje: nuevoMensaje.trim(),
      autor: 'usuario',
    });

    if (error) {
      toast({ title: 'Error', description: 'No se pudo enviar el mensaje', variant: 'destructive' });
    } else {
      setNuevoMensaje('');
      fetchMensajes();

      // Simulate support response after a delay
      setTimeout(async () => {
        await supabase.from('mensajes_soporte').insert({
          usuario_id: user.id,
          mensaje: 'Gracias por contactarnos. Un agente de soporte revisará tu mensaje pronto. Tiempo estimado de respuesta: 24 horas.',
          autor: 'soporte',
        });
        fetchMensajes();
      }, 1500);
    }

    setSending(false);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoy';
    if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  // Group messages by date
  const groupedMensajes = mensajes.reduce((acc, mensaje) => {
    const date = formatDate(mensaje.created_at);
    if (!acc[date]) acc[date] = [];
    acc[date].push(mensaje);
    return acc;
  }, {} as Record<string, Mensaje[]>);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center h-16 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="mr-3">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <Headphones className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold">Soporte Almalibre</h1>
              <p className="text-xs text-muted-foreground">Respondemos en 24h</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-32">
        <div className="container px-4 py-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : mensajes.length === 0 ? (
            <Card className="animate-fade-in">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">¡Hola {profile?.nombre || 'Usuario'}!</h3>
                <p className="text-muted-foreground text-sm text-center max-w-xs">
                  ¿En qué podemos ayudarte? Escribe tu mensaje y nuestro equipo te responderá lo antes posible.
                </p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedMensajes).map(([date, msgs]) => (
              <div key={date} className="space-y-3">
                <div className="flex justify-center">
                  <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {date}
                  </span>
                </div>
                {msgs.map((mensaje) => (
                  <div
                    key={mensaje.id}
                    className={cn(
                      'flex gap-2 animate-fade-in',
                      mensaje.autor === 'usuario' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {mensaje.autor === 'soporte' && (
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                        <Headphones className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-4 py-2',
                        mensaje.autor === 'usuario'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted rounded-bl-sm'
                      )}
                    >
                      <p className="text-sm">{mensaje.mensaje}</p>
                      <p
                        className={cn(
                          'text-xs mt-1',
                          mensaje.autor === 'usuario' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        )}
                      >
                        {formatTime(mensaje.created_at)}
                      </p>
                    </div>
                    {mensaje.autor === 'usuario' && (
                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Message Input */}
      <div className="fixed bottom-16 left-0 right-0 bg-background border-t p-4 safe-area-bottom">
        <div className="container">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="Escribe tu mensaje..."
              value={nuevoMensaje}
              onChange={(e) => setNuevoMensaje(e.target.value)}
              className="flex-1"
              disabled={sending}
            />
            <Button type="submit" size="icon" disabled={!nuevoMensaje.trim() || sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};
