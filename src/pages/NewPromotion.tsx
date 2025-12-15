import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { format, addDays } from 'date-fns';

export const NewPromotion = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const today = format(new Date(), 'yyyy-MM-dd');
  const nextMonth = format(addDays(new Date(), 30), 'yyyy-MM-dd');

  const [formData, setFormData] = useState({
    nombre: '',
    codigo: '',
    tipo_descuento: 'porcentaje',
    valor_descuento: '',
    fecha_inicio: today,
    fecha_expiracion: nextMonth,
    usos_maximos: '',
  });

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'ALM';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, codigo: code });
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!formData.nombre || !formData.codigo || !formData.valor_descuento) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos requeridos',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('codigos_promocionales')
        .insert({
          usuario_id: user.id,
          nombre: formData.nombre,
          codigo: formData.codigo.toUpperCase(),
          tipo_descuento: formData.tipo_descuento,
          valor_descuento: parseFloat(formData.valor_descuento),
          fecha_inicio: formData.fecha_inicio,
          fecha_expiracion: formData.fecha_expiracion,
          usos_maximos: formData.usos_maximos ? parseInt(formData.usos_maximos) : null,
        });

      if (error) {
        if (error.message.includes('duplicate')) {
          toast({
            title: 'Error',
            description: 'Este código ya existe',
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }

      setSuccess(true);
    } catch (error) {
      console.error('Error creating promo code:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear el código promocional',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md animate-fade-in">
          <CardContent className="pt-8 pb-6 text-center">
            <div className="w-20 h-20 bg-success-light rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <h2 className="text-2xl font-bold mb-2">¡Código Creado!</h2>
            <p className="text-muted-foreground mb-4">
              Tu código promocional está listo para usar
            </p>
            <code className="block bg-muted px-4 py-2 rounded text-lg font-mono mb-6">
              {formData.codigo.toUpperCase()}
            </code>
            <Button onClick={() => navigate('/promotions')} className="w-full">
              Ver Mis Códigos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center h-16 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/promotions')}
            className="mr-3"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Nuevo Código</h1>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información del Código</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre de la promoción *</Label>
              <Input
                id="nombre"
                placeholder="Ej: Descuento Verano 2024"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigo">Código *</Label>
              <div className="flex gap-2">
                <Input
                  id="codigo"
                  placeholder="ALMVERANO24"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                  className="font-mono uppercase"
                />
                <Button type="button" variant="outline" onClick={generateCode}>
                  Generar
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Tipo de descuento</Label>
              <RadioGroup
                value={formData.tipo_descuento}
                onValueChange={(value) => setFormData({ ...formData, tipo_descuento: value })}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="porcentaje" id="porcentaje" />
                  <Label htmlFor="porcentaje" className="font-normal">Porcentaje (%)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="monto_fijo" id="monto_fijo" />
                  <Label htmlFor="monto_fijo" className="font-normal">Monto Fijo (€)</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">
                Valor del descuento *{' '}
                {formData.tipo_descuento === 'porcentaje' ? '(%)' : '(€)'}
              </Label>
              <Input
                id="valor"
                type="number"
                placeholder={formData.tipo_descuento === 'porcentaje' ? '10' : '5.00'}
                value={formData.valor_descuento}
                onChange={(e) => setFormData({ ...formData, valor_descuento: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha_inicio">Fecha inicio</Label>
                <Input
                  id="fecha_inicio"
                  type="date"
                  value={formData.fecha_inicio}
                  onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_expiracion">Fecha fin</Label>
                <Input
                  id="fecha_expiracion"
                  type="date"
                  value={formData.fecha_expiracion}
                  onChange={(e) => setFormData({ ...formData, fecha_expiracion: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="usos">Límite de usos (opcional)</Label>
              <Input
                id="usos"
                type="number"
                placeholder="Sin límite"
                value={formData.usos_maximos}
                onChange={(e) => setFormData({ ...formData, usos_maximos: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSubmit} className="w-full" size="lg" disabled={loading}>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            'Crear Código Promocional'
          )}
        </Button>
      </main>
    </div>
  );
};
