import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmailNotifications, EmailConfig } from '@/hooks/useEmailNotifications';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Mail, Trash2, Plus, RefreshCw, AlertTriangle, Loader2, MailPlus } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const AdminEmailNotifications = () => {
  const { configuraciones, loading, error, addConfig, deleteConfig, refresh } = useEmailNotifications();
  const { toast } = useToast();

  const [selectedImei, setSelectedImei] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Fetch all machines for the select dropdown
  const { data: machines = [] } = useQuery({
    queryKey: ['admin-all-machines-email'],
    queryFn: async () => {
      const { data } = await supabase.from('maquinas').select('*');
      return (data || []) as { id: string; mac_address: string; nombre_personalizado: string; ubicacion: string | null }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const uniqueMachines = useMemo(() => {
    return Array.from(new Map(machines.map(m => [m.mac_address, m])).values());
  }, [machines]);

  // Group configs by IMEI
  const configsByMachine = useMemo(() => {
    const grouped: Record<string, EmailConfig[]> = {};
    for (const config of configuraciones) {
      if (!grouped[config.imei]) grouped[config.imei] = [];
      grouped[config.imei].push(config);
    }
    return grouped;
  }, [configuraciones]);

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = selectedImei && isEmailValid && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    const result = await addConfig(selectedImei, email.trim());

    if (result.success) {
      toast({ title: '✓ Email agregado', description: `${email} recibirá notificaciones de ventas.` });
      setEmail('');
      setSelectedImei('');
    } else if ((result as any).duplicate) {
      toast({ title: '⚠ Configuración duplicada', description: 'Este email ya está configurado para esta máquina.', variant: 'destructive' });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: number, emailAddr: string) => {
    setDeletingId(id);
    const result = await deleteConfig(id);
    if (result.success) {
      toast({ title: '✓ Email eliminado', description: `${emailAddr} ya no recibirá notificaciones.` });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
    setDeletingId(null);
  };

  const getMachineName = (imei: string) => {
    const machine = uniqueMachines.find(m => m.mac_address === imei);
    return machine?.nombre_personalizado || 'Máquina desconocida';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Mail className="h-6 w-6 text-primary" />
          Notificaciones por Email
        </h1>
        <p className="text-muted-foreground mt-1">
          Configura qué emails reciben notificaciones cuando hay una nueva venta. Puedes agregar múltiples emails por máquina.
        </p>
      </div>

      {/* Add form */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <MailPlus className="h-4 w-4" />
            Agregar notificación
          </CardTitle>
          <CardDescription>Selecciona una máquina y el email que recibirá las alertas de venta.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="machine-select">Máquina</Label>
              <Select value={selectedImei} onValueChange={setSelectedImei}>
                <SelectTrigger id="machine-select">
                  <SelectValue placeholder="Selecciona una máquina" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueMachines.map(m => (
                    <SelectItem key={m.mac_address} value={m.mac_address}>
                      {m.nombre_personalizado} (IMEI: {m.mac_address.slice(0, 8)}…)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 space-y-1.5">
              <Label htmlFor="email-input">Email</Label>
              <Input
                id="email-input"
                type="email"
                placeholder="ejemplo@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={email && !isEmailValid ? 'border-destructive' : ''}
              />
              {email && !isEmailValid && (
                <p className="text-xs text-destructive">Email inválido</p>
              )}
            </div>

            <div className="flex items-end">
              <Button type="submit" disabled={!canSubmit} className="w-full sm:w-auto">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Agregar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error al cargar</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="h-3 w-3 mr-1" /> Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && configuraciones.length === 0 && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <Mail className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg">No hay notificaciones configuradas</h3>
            <p className="text-muted-foreground text-sm max-w-md">
              Agrega el primer email para empezar a recibir notificaciones de ventas en tiempo real.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Grouped configs */}
      {!loading && Object.entries(configsByMachine).map(([imei, configs]) => (
        <Card key={imei}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              {getMachineName(imei)}
              <span className="text-xs font-normal text-muted-foreground">
                IMEI: {imei.slice(0, 8)}…
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {configs.map(config => (
              <div
                key={config.id}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/50 border"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{config.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Alta: {format(new Date(config.created_at), "dd MMM yyyy", { locale: es })}
                    </p>
                  </div>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      disabled={deletingId === config.id}
                    >
                      {deletingId === config.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar notificación?</AlertDialogTitle>
                      <AlertDialogDescription>
                        <strong>{config.email}</strong> dejará de recibir notificaciones de ventas para{' '}
                        <strong>{getMachineName(imei)}</strong>.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(config.id, config.email)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
