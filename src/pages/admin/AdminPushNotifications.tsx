import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Send, Smartphone, Users, Bell } from 'lucide-react'

export const AdminPushNotifications = () => {
  const { toast } = useToast()
  const [titulo, setTitulo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [url, setUrl] = useState('/')
  const [sending, setSending] = useState(false)

  const { data: stats } = useQuery({
    queryKey: ['push-subscription-stats'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true })
      if (error) throw error
      return { total: count || 0 }
    },
  })

  const handleSend = async () => {
    if (!titulo.trim() || !mensaje.trim()) {
      toast({
        title: 'Campos requeridos',
        description: 'Título y mensaje son obligatorios',
        variant: 'destructive',
      })
      return
    }

    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: { titulo, mensaje, url: url || '/' },
      })

      if (error) throw error

      toast({
        title: 'Notificaciones enviadas',
        description: `${data.sent} enviadas · ${data.failed} fallidas · ${data.total} suscripciones totales`,
      })

      setTitulo('')
      setMensaje('')
      setUrl('/')
    } catch (err: any) {
      toast({
        title: 'Error al enviar',
        description: err.message || 'No se pudieron enviar las notificaciones',
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Smartphone className="h-6 w-6 text-primary" />
          Notificaciones Push
        </h1>
        <p className="text-muted-foreground mt-1">
          Envía notificaciones directamente a los dispositivos de los franquiciados.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" />
            Enviar notificación
          </CardTitle>
          <CardDescription>
            Redacta el mensaje y envíalo a todos los dispositivos suscritos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm">
              <strong>{stats?.total ?? 0}</strong> dispositivos suscritos
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              placeholder="Ej: Nueva promoción disponible"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={60}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mensaje">Mensaje</Label>
            <Textarea
              id="mensaje"
              placeholder="Escribe el contenido de la notificación..."
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={4}
              maxLength={180}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL de destino (opcional)</Label>
            <Input
              id="url"
              placeholder="/"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Ruta a la que llevará al tocar la notificación, ej: /promotions
            </p>
          </div>

          <Button onClick={handleSend} disabled={sending} className="w-full sm:w-auto">
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar a todos los suscritos
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Bell className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="font-medium text-sm">¿Cómo funciona?</p>
              <p className="text-xs text-muted-foreground mt-1">
                Los usuarios deben activar las notificaciones push desde Ajustes → Notificaciones en la app.
                Una vez suscritos, sus dispositivos aparecerán en el contador y podrás enviarles mensajes en tiempo real.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
