import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMaquinas } from '@/hooks/useMaquinas';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react';

const incidentTypes = [
  'Problema de temperatura',
  'Error de dispensador',
  'Fallo de pantalla',
  'Problema de pago',
  'Atasco de producto',
  'Fuga de líquido',
  'Error de conexión',
  'Otro',
];

export const NewIncident = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { maquinas } = useMaquinas(user?.id);
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');
  
  const [formData, setFormData] = useState({
    maquina_id: '',
    tipo: '',
    descripcion: '',
    prioridad: 'normal',
  });

  const handleSubmit = async () => {
    if (!user) return;
    if (!formData.maquina_id || !formData.tipo || !formData.descripcion) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos requeridos',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Generate ticket number
      const { data: ticketData, error: ticketError } = await supabase
        .rpc('generate_ticket_number');
      
      if (ticketError) throw ticketError;

      // Create incident
      const { error } = await supabase
        .from('incidencias')
        .insert({
          usuario_id: user.id,
          maquina_id: formData.maquina_id,
          numero_ticket: ticketData,
          tipo: formData.tipo,
          descripcion: formData.descripcion,
          prioridad: formData.prioridad,
        });

      if (error) throw error;

      setTicketNumber(ticketData);
      setSuccess(true);
    } catch (error) {
      console.error('Error creating incident:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear la incidencia',
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
            <h2 className="text-2xl font-bold mb-2">¡Incidencia Reportada!</h2>
            <p className="text-muted-foreground mb-4">
              Tu ticket ha sido registrado exitosamente
            </p>
            <p className="text-lg font-semibold text-primary mb-6">
              {ticketNumber}
            </p>
            <Button onClick={() => navigate('/incidents')} className="w-full">
              Ver Mis Incidencias
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
            onClick={() => navigate('/incidents')}
            className="mr-3"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Nueva Incidencia</h1>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detalles de la Incidencia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Máquina *</Label>
              <Select
                value={formData.maquina_id}
                onValueChange={(value) => setFormData({ ...formData, maquina_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una máquina" />
                </SelectTrigger>
                <SelectContent>
                  {maquinas.map((maquina) => (
                    <SelectItem key={maquina.id} value={maquina.id}>
                      {maquina.nombre_personalizado}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Problema *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  {incidentTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción *</Label>
              <Textarea
                id="descripcion"
                placeholder="Describe el problema con detalle..."
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                rows={4}
              />
            </div>

            <div className="space-y-3">
              <Label>Prioridad</Label>
              <RadioGroup
                value={formData.prioridad}
                onValueChange={(value) => setFormData({ ...formData, prioridad: value })}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="normal" id="normal" />
                  <Label htmlFor="normal" className="font-normal">Normal</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="urgente" id="urgente" />
                  <Label htmlFor="urgente" className="font-normal text-critical">Urgente</Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSubmit} className="w-full" size="lg" disabled={loading}>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            'Enviar Incidencia'
          )}
        </Button>
      </main>
    </div>
  );
};
