import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Check, Crown, Loader2, Star, Zap } from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';

interface Suscripcion {
  id: string;
  plan: string;
  estado: string;
  precio_mensual: number;
  fecha_inicio: string;
  fecha_renovacion: string | null;
}

const planes = [
  {
    id: 'basico',
    nombre: 'Plan Básico',
    precio: 0,
    descripcion: 'Acceso básico a la plataforma',
    icon: Star,
    features: [
      'Monitoreo de 1 máquina',
      'Alertas básicas',
      'Historial de 7 días',
      'Soporte por email',
    ],
  },
  {
    id: 'pro',
    nombre: 'Plan Pro',
    precio: 29,
    descripcion: 'Para negocios en crecimiento',
    icon: Zap,
    popular: true,
    features: [
      'Monitoreo ilimitado de máquinas',
      'Alertas avanzadas en tiempo real',
      'Historial de 90 días',
      'Soporte prioritario',
      'Códigos promocionales',
      'Reportes de ventas',
    ],
  },
  {
    id: 'premium',
    nombre: 'Plan Premium',
    precio: 59,
    descripcion: 'Soporte dedicado y visitas',
    icon: Crown,
    features: [
      'Todo lo del Plan Pro',
      'Historial ilimitado',
      'Soporte dedicado 24/7',
      'Visitas técnicas incluidas',
      'Análisis predictivo',
      'API personalizada',
    ],
  },
];

export const Subscription = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [suscripcion, setSuscripcion] = useState<Suscripcion | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchSuscripcion();
    }
  }, [user]);

  const fetchSuscripcion = async () => {
    const { data, error } = await supabase
      .from('suscripciones')
      .select('*')
      .eq('usuario_id', user?.id)
      .eq('estado', 'activa')
      .maybeSingle();

    if (!error && data) {
      setSuscripcion(data);
    }
    setLoading(false);
  };

  const handleSubscribe = async (planId: string) => {
    toast({
      title: '🚀 Próximamente',
      description: 'Los planes de suscripción estarán disponibles muy pronto. ¡Mantente atento!',
    });
  };

  const getPlanActual = () => {
    if (!suscripcion) return 'basico';
    return planes.find(p => p.nombre === suscripcion.plan)?.id || 'basico';
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center h-16 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="mr-3">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Mi Suscripción</h1>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {suscripcion && (
              <Card className="animate-fade-in border-primary">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Plan Actual</CardTitle>
                    <Badge variant="default">{suscripcion.estado}</Badge>
                  </div>
                  <CardDescription>
                    {suscripcion.plan} - €{suscripcion.precio_mensual}/mes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {suscripcion.fecha_renovacion && (
                    <p className="text-sm text-muted-foreground">
                      Próxima renovación: {new Date(suscripcion.fecha_renovacion).toLocaleDateString('es-ES')}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Planes Disponibles</h2>
              {planes.map((plan, index) => {
                const isActive = getPlanActual() === plan.id;
                const Icon = plan.icon;

                return (
                  <Card
                    key={plan.id}
                    className={`animate-fade-in relative ${isActive ? 'border-primary' : ''} ${plan.popular ? 'ring-2 ring-primary' : ''}`}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary">Más Popular</Badge>
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-base">{plan.nombre}</CardTitle>
                          <CardDescription>{plan.descripcion}</CardDescription>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">€{plan.precio}</p>
                          <p className="text-xs text-muted-foreground">/mes</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ul className="space-y-2">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <Button
                        className="w-full"
                        variant={isActive ? 'outline' : 'default'}
                        disabled={isActive || subscribing !== null}
                        onClick={() => handleSubscribe(plan.id)}
                      >
                        {subscribing === plan.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isActive ? (
                          'Plan Actual'
                        ) : (
                          'Seleccionar Plan'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
};
