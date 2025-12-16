import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, BellRing, Mail, Package, Thermometer, TrendingDown, Wrench, Tag, Smartphone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { usePreferenciasNotificaciones } from '@/hooks/useNotificaciones';
import { BottomNav } from '@/components/layout/BottomNav';
import { checkPushNotificationStatus, initPushNotifications } from '@/services/pushNotifications';
import { useEffect, useState } from 'react';

export const NotificationSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { preferencias, isLoading, actualizarPreferencias, isUpdating } = usePreferenciasNotificaciones();
  const [pushStatus, setPushStatus] = useState<{ available: boolean; enabled: boolean; platform: string }>({
    available: false,
    enabled: false,
    platform: 'web'
  });

  useEffect(() => {
    checkPushNotificationStatus().then(setPushStatus);
  }, []);

  const handleToggle = async (key: keyof typeof preferencias, value: boolean) => {
    actualizarPreferencias({ [key]: value });
    toast({
      title: 'Preferencias actualizadas',
      description: 'Tus preferencias de notificaciones han sido guardadas',
    });
  };

  const handleSliderChange = (value: number[]) => {
    actualizarPreferencias({ umbral_stock: value[0] });
  };

  const handleEnablePush = async () => {
    const result = await initPushNotifications();
    if (result.success) {
      setPushStatus({ ...pushStatus, enabled: true });
      toast({
        title: 'Notificaciones activadas',
        description: 'Recibirás notificaciones push en este dispositivo',
      });
    } else {
      toast({
        title: 'No se pudieron activar',
        description: 'Verifica los permisos de notificaciones en tu dispositivo',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center h-16 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/settings')}
            className="mr-3"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Notificaciones</h1>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        {/* Push Status Card */}
        {pushStatus.platform !== 'web' && (
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Estado de Push
              </CardTitle>
              <CardDescription>
                Notificaciones push en este dispositivo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pushStatus.enabled ? (
                <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm text-green-700 dark:text-green-400">
                    Notificaciones push activadas
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-lg">
                    <div className="w-3 h-3 bg-amber-500 rounded-full" />
                    <span className="text-sm text-amber-700 dark:text-amber-400">
                      Notificaciones push desactivadas
                    </span>
                  </div>
                  <Button onClick={handleEnablePush} className="w-full">
                    <BellRing className="h-4 w-4 mr-2" />
                    Activar notificaciones push
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Web Notice */}
        {pushStatus.platform === 'web' && (
          <Card className="animate-fade-in border-amber-500/50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Smartphone className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Notificaciones push no disponibles</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Las notificaciones push solo están disponibles en la app móvil. 
                    Descarga la app para recibir alertas en tiempo real.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Machine Alerts */}
        <Card className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <CardTitle className="text-base">Alertas de máquinas</CardTitle>
            <CardDescription>
              Recibe alertas sobre el estado de tus máquinas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <TrendingDown className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <Label htmlFor="stock_bajo" className="text-sm font-medium">Stock bajo</Label>
                  <p className="text-xs text-muted-foreground">Cuando un topping esté bajo</p>
                </div>
              </div>
              <Switch
                id="stock_bajo"
                checked={preferencias.stock_bajo}
                onCheckedChange={(checked) => handleToggle('stock_bajo', checked)}
                disabled={isUpdating}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-red-500/10 rounded-lg flex items-center justify-center">
                  <Thermometer className="h-4 w-4 text-red-500" />
                </div>
                <div>
                  <Label htmlFor="temperatura_alerta" className="text-sm font-medium">Alerta de temperatura</Label>
                  <p className="text-xs text-muted-foreground">Cuando la temperatura sea anormal</p>
                </div>
              </div>
              <Switch
                id="temperatura_alerta"
                checked={preferencias.temperatura_alerta}
                onCheckedChange={(checked) => handleToggle('temperatura_alerta', checked)}
                disabled={isUpdating}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <span className="text-sm">💰</span>
                </div>
                <div>
                  <Label htmlFor="nuevas_ventas" className="text-sm font-medium">Nuevas ventas</Label>
                  <p className="text-xs text-muted-foreground">Cada vez que se realice una venta</p>
                </div>
              </div>
              <Switch
                id="nuevas_ventas"
                checked={preferencias.nuevas_ventas}
                onCheckedChange={(checked) => handleToggle('nuevas_ventas', checked)}
                disabled={isUpdating}
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-sm">Umbral de alerta de stock</Label>
              <p className="text-xs text-muted-foreground">
                Alertar cuando el stock sea menor al {preferencias.umbral_stock}%
              </p>
              <Slider
                value={[preferencias.umbral_stock]}
                onValueCommit={handleSliderChange}
                min={5}
                max={50}
                step={5}
                className="mt-2"
                disabled={isUpdating}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5%</span>
                <span className="font-medium text-foreground">{preferencias.umbral_stock}%</span>
                <span>50%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders & Incidents */}
        <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <CardHeader>
            <CardTitle className="text-base">Pedidos e incidencias</CardTitle>
            <CardDescription>
              Actualizaciones sobre tus pedidos y tickets de soporte
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Package className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <Label htmlFor="pedidos" className="text-sm font-medium">Pedidos</Label>
                  <p className="text-xs text-muted-foreground">Actualizaciones de tus pedidos</p>
                </div>
              </div>
              <Switch
                id="pedidos"
                checked={preferencias.pedidos}
                onCheckedChange={(checked) => handleToggle('pedidos', checked)}
                disabled={isUpdating}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <Wrench className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <Label htmlFor="incidencias" className="text-sm font-medium">Incidencias</Label>
                  <p className="text-xs text-muted-foreground">Actualizaciones de tus tickets</p>
                </div>
              </div>
              <Switch
                id="incidencias"
                checked={preferencias.incidencias}
                onCheckedChange={(checked) => handleToggle('incidencias', checked)}
                disabled={isUpdating}
              />
            </div>
          </CardContent>
        </Card>

        {/* Marketing */}
        <Card className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <CardHeader>
            <CardTitle className="text-base">Marketing</CardTitle>
            <CardDescription>
              Promociones y novedades de Almalibre
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-pink-500/10 rounded-lg flex items-center justify-center">
                  <Tag className="h-4 w-4 text-pink-500" />
                </div>
                <div>
                  <Label htmlFor="promociones" className="text-sm font-medium">Promociones</Label>
                  <p className="text-xs text-muted-foreground">Ofertas y novedades</p>
                </div>
              </div>
              <Switch
                id="promociones"
                checked={preferencias.promociones}
                onCheckedChange={(checked) => handleToggle('promociones', checked)}
                disabled={isUpdating}
              />
            </div>
          </CardContent>
        </Card>

        {/* Channels */}
        <Card className="animate-fade-in" style={{ animationDelay: '400ms' }}>
          <CardHeader>
            <CardTitle className="text-base">Canales de notificación</CardTitle>
            <CardDescription>
              Elige cómo quieres recibir las notificaciones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Bell className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <Label htmlFor="canal_push" className="text-sm font-medium">Notificaciones push</Label>
                  <p className="text-xs text-muted-foreground">En tu dispositivo móvil</p>
                </div>
              </div>
              <Switch
                id="canal_push"
                checked={preferencias.canal_push}
                onCheckedChange={(checked) => handleToggle('canal_push', checked)}
                disabled={isUpdating}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <Label htmlFor="canal_email" className="text-sm font-medium">Correo electrónico</Label>
                  <p className="text-xs text-muted-foreground">Resumen de alertas por email</p>
                </div>
              </div>
              <Switch
                id="canal_email"
                checked={preferencias.canal_email}
                onCheckedChange={(checked) => handleToggle('canal_email', checked)}
                disabled={isUpdating}
              />
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};
