import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react';

interface CartItem {
  product: {
    id: string;
    nombre: string;
    precio: number;
  };
  quantity: number;
}

export const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const cart = (location.state?.cart as CartItem[]) || [];
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  
  const [formData, setFormData] = useState({
    direccion: profile?.direccion || '',
    notas: '',
  });

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.precio * item.quantity,
    0
  );
  const envio = subtotal > 50 ? 0 : 5.99;
  const total = subtotal + envio;

  const handleSubmit = async () => {
    if (!user) return;
    if (!formData.direccion.trim()) {
      toast({
        title: 'Error',
        description: 'Por favor ingresa una dirección de envío',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Generate order number
      const { data: orderNumberData, error: orderNumberError } = await supabase
        .rpc('generate_order_number');
      
      if (orderNumberError) throw orderNumberError;

      // Create order
      const { data: orderData, error: orderError } = await supabase
        .from('pedidos')
        .insert({
          usuario_id: user.id,
          numero_pedido: orderNumberData,
          subtotal,
          envio,
          total,
          direccion_envio: formData.direccion,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cart.map((item) => ({
        pedido_id: orderData.id,
        producto_id: item.product.id,
        cantidad: item.quantity,
        precio_unitario: item.product.precio,
        subtotal: item.product.precio * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('pedido_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      setOrderNumber(orderNumberData);
      setSuccess(true);
    } catch (error) {
      console.error('Error creating order:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear el pedido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0 && !success) {
    navigate('/store');
    return null;
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md animate-fade-in">
          <CardContent className="pt-8 pb-6 text-center">
            <div className="w-20 h-20 bg-success-light rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <h2 className="text-2xl font-bold mb-2">¡Pedido Realizado!</h2>
            <p className="text-muted-foreground mb-4">
              Tu pedido ha sido registrado exitosamente
            </p>
            <p className="text-lg font-semibold text-primary mb-6">
              {orderNumber}
            </p>
            <Button onClick={() => navigate('/orders')} className="w-full">
              Ver Mis Pedidos
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
            onClick={() => navigate('/store')}
            className="mr-3"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Confirmar Pedido</h1>
        </div>
      </header>

      <main className="container px-4 py-6 space-y-6">
        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumen del Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cart.map((item) => (
              <div key={item.product.id} className="flex justify-between text-sm">
                <span>
                  {item.product.nombre} x{item.quantity}
                </span>
                <span>€{(item.product.precio * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>€{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Envío {subtotal > 50 && <span className="text-success">(Gratis)</span>}</span>
                <span>€{envio.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t">
                <span>Total</span>
                <span className="text-primary">€{total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Address */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dirección de Envío</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección completa</Label>
              <Textarea
                id="direccion"
                placeholder="Calle, número, piso, ciudad, código postal..."
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notas">Notas adicionales (opcional)</Label>
              <Input
                id="notas"
                placeholder="Instrucciones de entrega..."
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSubmit} className="w-full" size="lg" disabled={loading}>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            `Confirmar Pedido - €${total.toFixed(2)}`
          )}
        </Button>
      </main>
    </div>
  );
};
