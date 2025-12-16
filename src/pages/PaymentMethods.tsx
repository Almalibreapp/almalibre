import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, CreditCard, Plus, Trash2, Loader2, Building } from 'lucide-react';
import { BottomNav } from '@/components/layout/BottomNav';

interface MetodoPago {
  id: string;
  tipo: string;
  nombre: string;
  ultimos_digitos: string | null;
  predeterminado: boolean;
}

export const PaymentMethods = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'tarjeta',
    nombre: '',
    ultimos_digitos: '',
  });

  useEffect(() => {
    if (user) {
      fetchMetodos();
    }
  }, [user]);

  const fetchMetodos = async () => {
    const { data, error } = await supabase
      .from('metodos_pago')
      .select('*')
      .eq('usuario_id', user?.id)
      .order('predeterminado', { ascending: false });

    if (!error && data) {
      setMetodos(data);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      toast({ title: 'Error', description: 'El nombre es requerido', variant: 'destructive' });
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('metodos_pago').insert({
      usuario_id: user?.id,
      tipo: formData.tipo,
      nombre: formData.nombre,
      ultimos_digitos: formData.ultimos_digitos || null,
      predeterminado: metodos.length === 0,
    });

    if (error) {
      toast({ title: 'Error', description: 'No se pudo guardar el método de pago', variant: 'destructive' });
    } else {
      toast({ title: 'Guardado', description: 'Método de pago añadido' });
      setDialogOpen(false);
      setFormData({ tipo: 'tarjeta', nombre: '', ultimos_digitos: '' });
      fetchMetodos();
    }

    setSaving(false);
  };

  const handleSetDefault = async (id: string) => {
    // First remove default from all
    await supabase
      .from('metodos_pago')
      .update({ predeterminado: false })
      .eq('usuario_id', user?.id);

    // Then set the new default
    await supabase
      .from('metodos_pago')
      .update({ predeterminado: true })
      .eq('id', id);

    toast({ title: 'Actualizado', description: 'Método de pago predeterminado actualizado' });
    fetchMetodos();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('metodos_pago').delete().eq('id', id);

    if (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' });
    } else {
      toast({ title: 'Eliminado', description: 'Método de pago eliminado' });
      fetchMetodos();
    }
  };

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case 'tarjeta':
        return CreditCard;
      case 'transferencia':
        return Building;
      default:
        return CreditCard;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="mr-3">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold text-lg">Métodos de Pago</h1>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Añadir
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Añadir Método de Pago</DialogTitle>
                <DialogDescription>Añade una nueva forma de pago a tu cuenta</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tarjeta">Tarjeta de Crédito/Débito</SelectItem>
                      <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nombre / Alias</Label>
                  <Input
                    placeholder="Mi tarjeta personal"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  />
                </div>
                {formData.tipo === 'tarjeta' && (
                  <div className="space-y-2">
                    <Label>Últimos 4 dígitos</Label>
                    <Input
                      placeholder="1234"
                      maxLength={4}
                      value={formData.ultimos_digitos}
                      onChange={(e) => setFormData({ ...formData, ultimos_digitos: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : metodos.length === 0 ? (
          <Card className="animate-fade-in">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-2">Sin métodos de pago</h3>
              <p className="text-muted-foreground text-sm text-center mb-4">
                Añade un método de pago para realizar compras
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Añadir Método
              </Button>
            </CardContent>
          </Card>
        ) : (
          metodos.map((metodo, index) => {
            const Icon = getIcon(metodo.tipo);
            return (
              <Card
                key={metodo.id}
                className="animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{metodo.nombre}</h3>
                      {metodo.predeterminado && <Badge variant="secondary">Predeterminado</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {metodo.tipo === 'tarjeta' && metodo.ultimos_digitos
                        ? `**** **** **** ${metodo.ultimos_digitos}`
                        : metodo.tipo === 'tarjeta'
                        ? 'Tarjeta'
                        : 'Transferencia bancaria'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!metodo.predeterminado && (
                      <Button variant="outline" size="sm" onClick={() => handleSetDefault(metodo.id)}>
                        Usar
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(metodo.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </main>

      <BottomNav />
    </div>
  );
};
