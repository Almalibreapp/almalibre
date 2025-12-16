import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useMaquinas } from '@/hooks/useMaquinas';
import { ArrowLeft, Smartphone, MapPin, Tag, Loader2 } from 'lucide-react';

const imeiSchema = z.object({
  mac_address: z.string()
    .regex(/^\d{15}$/, 'El IMEI debe tener exactamente 15 dígitos'),
  nombre_personalizado: z.string()
    .min(2, 'Nombre muy corto')
    .max(100, 'Nombre muy largo'),
  ubicacion: z.string()
    .max(200, 'Ubicación muy larga')
    .optional(),
});

export const AddMachine = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { addMaquina } = useMaquinas(user?.id);
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    mac_address: '',
    nombre_personalizado: '',
    ubicacion: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formatImei = (value: string) => {
    // Only allow digits, max 15
    return value.replace(/\D/g, '').slice(0, 15);
  };

  const handleImeiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatImei(e.target.value);
    setFormData({ ...formData, mac_address: formatted });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = imeiSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    const { error } = await addMaquina(
      formData.mac_address,
      formData.nombre_personalizado,
      formData.ubicacion || ''
    );
    setLoading(false);

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        toast({
          title: 'IMEI ya registrado',
          description: 'Este IMEI ya está asociado a otra cuenta.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: 'No se pudo añadir la máquina. Intenta de nuevo.',
          variant: 'destructive',
        });
      }
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
          <h1 className="font-semibold text-lg">Añadir Máquina</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6">
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Nueva Máquina</CardTitle>
            <CardDescription>
              Ingresa los datos de tu máquina de helados para comenzar a monitorearla.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="imei">IMEI de la Máquina</Label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="imei"
                    placeholder="865622072045888"
                    className="pl-10 font-mono tracking-wider"
                    value={formData.mac_address}
                    onChange={handleImeiChange}
                    maxLength={15}
                    inputMode="numeric"
                  />
                </div>
                {errors.mac_address && (
                  <p className="text-sm text-destructive">{errors.mac_address}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Encuentra el IMEI de 15 dígitos en la etiqueta de tu máquina
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
                    onChange={(e) => setFormData({ ...formData, nombre_personalizado: e.target.value })}
                  />
                </div>
                {errors.nombre_personalizado && (
                  <p className="text-sm text-destructive">{errors.nombre_personalizado}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ubicacion">Ubicación (opcional)</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="ubicacion"
                    placeholder="Ej: Av. Principal 123, Local 5"
                    className="pl-10"
                    value={formData.ubicacion}
                    onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                  />
                </div>
                {errors.ubicacion && (
                  <p className="text-sm text-destructive">{errors.ubicacion}</p>
                )}
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Añadir Máquina'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
