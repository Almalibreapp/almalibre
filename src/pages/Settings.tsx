import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { BottomNav } from '@/components/layout/BottomNav';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  LogOut,
  Loader2,
  IceCream,
  CreditCard,
  Crown,
  Headphones,
  Tag,
  ChevronRight,
  Package,
  Bell,
  AlertTriangle,
  GraduationCap,
  Wrench,
} from 'lucide-react';

const menuItems = [
  { path: '/notifications', icon: Bell, label: 'Notificaciones', description: 'Configura tus alertas' },
  { path: '/subscription', icon: Crown, label: 'Mi Suscripción', description: 'Gestiona tu plan' },
  { path: '/payment-methods', icon: CreditCard, label: 'Métodos de Pago', description: 'Tarjetas y cuentas' },
  { path: '/orders', icon: Package, label: 'Mis Pedidos', description: 'Historial de compras' },
];

const supportItems = [
  { path: '/support', icon: Headphones, label: 'Soporte Técnico', description: 'Asistente IA 24/7' },
  { path: '/incidents', icon: AlertTriangle, label: 'Incidencias', description: 'Historial de incidencias' },
];

const toolItems = [
  { path: '/tutorials', icon: GraduationCap, label: 'Video Tutoriales', description: 'Aprende a usar tu máquina' },
  { path: '/promotions', icon: Tag, label: 'Generador de Códigos', description: 'Códigos promocionales' },
];

export const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, signOut, updateProfile } = useAuth();

  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [formData, setFormData] = useState({
    nombre: profile?.nombre || '',
    telefono: profile?.telefono || '',
  });

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre es requerido',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const { error } = await updateProfile({
      nombre: formData.nombre,
      telefono: formData.telefono,
    });
    setLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el perfil',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Guardado',
        description: 'Tu perfil ha sido actualizado',
      });
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await signOut();
    setLoggingOut(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center h-16 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="mr-3"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Mi Perfil</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6 space-y-6">
        {/* Profile Card */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Mi Perfil</CardTitle>
            <CardDescription>
              Actualiza tu información personal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  value={profile?.email || ''}
                  className="pl-10 bg-muted"
                  disabled
                />
              </div>
              <p className="text-xs text-muted-foreground">
                El email no se puede modificar
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="nombre"
                  placeholder="Tu nombre"
                  className="pl-10"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="telefono"
                  placeholder="+34 612 345 678"
                  className="pl-10"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                />
              </div>
            </div>

            <Button onClick={handleSave} className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Guardar Cambios'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Menu Items */}
        <Card className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <CardTitle>Cuenta</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {menuItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors border-b last:border-b-0"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Support Section */}
        <Card className="animate-fade-in" style={{ animationDelay: '150ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5" />
              Soporte e Incidencias
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {supportItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors border-b last:border-b-0"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Tools Section */}
        <Card className="animate-fade-in" style={{ animationDelay: '175ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Herramientas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {toolItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors border-b last:border-b-0"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Session Card */}
        <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <CardHeader>
            <CardTitle>Sesión</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full text-destructive hover:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Cerrar Sesión
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tendrás que iniciar sesión nuevamente para acceder a tu cuenta.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLogout}>
                    {loggingOut ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Cerrar Sesión'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* About Card */}
        <Card className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <CardHeader>
            <CardTitle>Acerca de</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                <IceCream className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">Almalibre Franquicias</h3>
                <p className="text-sm text-muted-foreground">Versión 1.0.0</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Sistema de gestión y monitoreo de máquinas de helados para franquiciados Almalibre.
            </p>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};
