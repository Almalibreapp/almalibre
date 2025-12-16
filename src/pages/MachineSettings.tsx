import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { useMaquinas } from '@/hooks/useMaquinas';
import { ArrowLeft, Tag, MapPin, Smartphone, Trash2, Loader2 } from 'lucide-react';

export const MachineSettings = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const { maquinas, updateMaquina, deleteMaquina } = useMaquinas(user?.id);

  const maquina = maquinas.find((m) => m.id === id);

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    nombre_personalizado: maquina?.nombre_personalizado || '',
    ubicacion: maquina?.ubicacion || '',
  });

  if (!maquina) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Máquina no encontrada</p>
          <Button variant="link" onClick={() => navigate('/')}>
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    if (!formData.nombre_personalizado.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre es requerido',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const { error } = await updateMaquina(id!, {
      nombre_personalizado: formData.nombre_personalizado,
      ubicacion: formData.ubicacion,
    });
    setLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la máquina',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Guardado',
        description: 'Los cambios se han guardado correctamente',
      });
      navigate(`/machine/${id}`);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await deleteMaquina(id!);
    setDeleting(false);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la máquina',
        variant: 'destructive',
      });
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center h-16 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="mr-3"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Configurar Máquina</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6 space-y-6">
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Información</CardTitle>
            <CardDescription>
              Edita el nombre y ubicación de tu máquina
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="imei">IMEI de la Máquina</Label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="imei"
                  value={maquina.mac_address}
                  className="pl-10 font-mono tracking-wider bg-muted"
                  disabled
                />
              </div>
              <p className="text-xs text-muted-foreground">
                El IMEI no se puede modificar
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre personalizado</Label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="nombre"
                  placeholder="Ej: Centro Comercial Plaza Norte"
                  className="pl-10"
                  value={formData.nombre_personalizado}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre_personalizado: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ubicacion">Ubicación</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="ubicacion"
                  placeholder="Ej: Av. Principal 123, Local 5"
                  className="pl-10"
                  value={formData.ubicacion}
                  onChange={(e) =>
                    setFormData({ ...formData, ubicacion: e.target.value })
                  }
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

        <Card className="border-destructive/50 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
            <CardDescription>
              Esta acción no se puede deshacer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar Máquina
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar máquina?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará permanentemente la máquina "{maquina.nombre_personalizado}" 
                    y todos sus datos asociados. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Eliminar'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
