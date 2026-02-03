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
import { ArrowLeft, Loader2, ExternalLink, CreditCard } from 'lucide-react';

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
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  
  // Parse name from profile
  const nameParts = (profile?.nombre || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  const [formData, setFormData] = useState({
    first_name: firstName,
    last_name: lastName,
    email: profile?.email || user?.email || '',
    phone: profile?.telefono || '',
    address_1: profile?.direccion || '',
    city: '',
    postcode: '',
    notas: '',
  });

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.precio * item.quantity,
    0
  );
  const envio = subtotal > 50 ? 0 : 5.99;
  const total = subtotal + envio;

  const validateForm = () => {
    if (!formData.first_name.trim()) {
      toast({ title: 'Error', description: 'Por favor ingresa tu nombre', variant: 'destructive' });
      return false;
    }
    if (!formData.email.trim()) {
      toast({ title: 'Error', description: 'Por favor ingresa tu email', variant: 'destructive' });
      return false;
    }
    if (!formData.address_1.trim()) {
      toast({ title: 'Error', description: 'Por favor ingresa tu dirección', variant: 'destructive' });
      return false;
    }
    if (!formData.city.trim()) {
      toast({ title: 'Error', description: 'Por favor ingresa tu ciudad', variant: 'destructive' });
      return false;
    }
    if (!formData.postcode.trim()) {
      toast({ title: 'Error', description: 'Por favor ingresa tu código postal', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Prepare items for WooCommerce
      const items = cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        name: item.product.nombre,
        price: item.product.precio,
      }));

      // Create order in WooCommerce
      const { data, error } = await supabase.functions.invoke('woocommerce-checkout', {
        body: {
          items,
          billing: {
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            phone: formData.phone,
            address_1: formData.address_1,
            city: formData.city,
            postcode: formData.postcode,
            country: 'ES',
          },
          customer_note: formData.notas,
        },
      });

      if (error) {
        // Try to extract backend-provided message (503/400 etc.) when available
        const anyErr = error as any;
        const response = anyErr?.context?.response;
        if (response && typeof response.json === 'function') {
          try {
            const payload = await response.json();
            if (payload?.error) {
              throw new Error(payload.error);
            }
          } catch {
            // fall through
          }
        }
        throw new Error('No se pudo crear el pedido. Intenta de nuevo en unos segundos.');
      }

      if (data?.payment_url) {
        setPaymentUrl(data.payment_url);
        toast({
          title: '¡Pedido creado!',
          description: `Pedido #${data.order_number} - Redirigiendo al pago...`,
        });
        
        // Auto-redirect after a short delay
        setTimeout(() => {
          window.open(data.payment_url, '_blank');
        }, 1500);
      } else {
        throw new Error('No se recibió la URL de pago');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo crear el pedido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0 && !paymentUrl) {
    navigate('/store');
    return null;
  }

  if (paymentUrl) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md animate-fade-in">
          <CardContent className="pt-8 pb-6 text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CreditCard className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">¡Pedido Creado!</h2>
            <p className="text-muted-foreground mb-6">
              Tu pedido ha sido creado. Haz clic en el botón para completar el pago de forma segura.
            </p>
            
            <div className="space-y-3">
              <Button 
                onClick={() => window.open(paymentUrl, '_blank')} 
                className="w-full gap-2"
                size="lg"
              >
                <ExternalLink className="h-4 w-4" />
                Ir a Pagar
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => navigate('/store')} 
                className="w-full"
              >
                Volver a la Tienda
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-4">
              Serás redirigido a la pasarela de pago segura de Almalibre
            </p>
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

      <main className="container px-4 py-6 space-y-6 pb-32">
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

        {/* Customer Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Datos de Contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Nombre *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="Juan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Apellidos</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="García"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="tu@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+34 600 000 000"
              />
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
              <Label htmlFor="address_1">Dirección *</Label>
              <Textarea
                id="address_1"
                placeholder="Calle, número, piso, puerta..."
                value={formData.address_1}
                onChange={(e) => setFormData({ ...formData, address_1: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Ciudad *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Valencia"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postcode">Código Postal *</Label>
                <Input
                  id="postcode"
                  value={formData.postcode}
                  onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                  placeholder="46000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notas">Notas del pedido (opcional)</Label>
              <Input
                id="notas"
                placeholder="Instrucciones de entrega, horarios..."
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSubmit} className="w-full" size="lg" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Procesando...
            </>
          ) : (
            <>
              <CreditCard className="h-5 w-5 mr-2" />
              Continuar al Pago - €{total.toFixed(2)}
            </>
          )}
        </Button>
        
        <p className="text-xs text-center text-muted-foreground">
          Al continuar, serás redirigido a la pasarela de pago segura de Almalibre para completar tu compra.
        </p>
      </main>
    </div>
  );
};
