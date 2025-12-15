import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/layout/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Tag, Loader2, Copy, Calendar, Users, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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

interface PromoCode {
  id: string;
  nombre: string;
  codigo: string;
  tipo_descuento: string;
  valor_descuento: number;
  fecha_inicio: string;
  fecha_expiracion: string;
  usos_maximos: number | null;
  usos_actuales: number | null;
  estado: string;
}

const statusColors: Record<string, string> = {
  activo: 'bg-success-light text-success',
  pausado: 'bg-warning-light text-warning-foreground',
  expirado: 'bg-muted text-muted-foreground',
};

export const Promotions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchCodes();
    }
  }, [user]);

  const fetchCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('codigos_promocionales')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCodes(data || []);
    } catch (error) {
      console.error('Error fetching promo codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: 'Código copiado',
      description: code,
    });
  };

  const deleteCode = async (id: string) => {
    try {
      const { error } = await supabase
        .from('codigos_promocionales')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCodes((prev) => prev.filter((c) => c.id !== id));
      toast({
        title: 'Código eliminado',
        description: 'El código promocional ha sido eliminado',
      });
    } catch (error) {
      console.error('Error deleting code:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el código',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center justify-between h-16 px-4">
          <h1 className="font-semibold text-lg">Promociones</h1>
          <Button size="sm" onClick={() => navigate('/promotions/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo
          </Button>
        </div>
      </header>

      <main className="container px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : codes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Tag className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">Sin códigos</h2>
              <p className="text-muted-foreground text-center mb-4">
                Crea códigos promocionales para tus clientes
              </p>
              <Button onClick={() => navigate('/promotions/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Código
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {codes.map((code) => (
              <Card key={code.id} className="animate-fade-in">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{code.nombre}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                          {code.codigo}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => copyCode(code.codigo)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[code.estado]}>
                        {code.estado}
                      </Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar código?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteCode(code.id)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-2xl font-bold text-primary">
                      {code.tipo_descuento === 'porcentaje'
                        ? `${code.valor_descuento}%`
                        : `€${code.valor_descuento}`}
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(code.fecha_inicio), 'd MMM', { locale: es })} -{' '}
                      {format(new Date(code.fecha_expiracion), 'd MMM yyyy', { locale: es })}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {code.usos_actuales || 0}
                      {code.usos_maximos && ` / ${code.usos_maximos}`} usos
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};
