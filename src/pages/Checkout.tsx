import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useDirecciones, type DireccionGuardada } from '@/hooks/useDirecciones';
import {
  ArrowLeft, Loader2, ExternalLink, CreditCard,
  MapPin, Star, Plus, Trash2, ChevronDown, ChevronUp, Save,
} from 'lucide-react';
import type { CartItem } from '@/types/cart';

interface FormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_1: string;
  city: string;
  postcode: string;
  notas: string;
}

// ── Address Picker ──────────────────────────────────────────────────────────
interface AddressPickerProps {
  direcciones: DireccionGuardada[];
  onSelect: (dir: DireccionGuardada) => void;
  onDelete: (id: string) => void;
  onFavorite: (id: string) => void;
  selected: string | null;
}

const AddressPicker = ({ direcciones, onSelect, onDelete, onFavorite, selected }: AddressPickerProps) => {
  if (direcciones.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Direcciones guardadas</p>
      {direcciones.map(dir => (
        <div
          key={dir.id}
          onClick={() => onSelect(dir)}
            className={`relative flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
            selected === dir.id
              ? 'border-primary bg-primary/5 shadow-sm'
              : 'border-border hover:border-primary/40 hover:bg-muted/40'
            }`}
        >
          {dir.es_favorita && (
            <Star className="h-3.5 w-3.5 text-amber-400 absolute top-2 right-8 fill-amber-400" />
          )}
          <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{dir.nombre}</p>
            <p className="text-xs text-muted-foreground truncate">{dir.address_1}, {dir.city} {dir.postcode}</p>
          </div>
          <div className="flex gap-1 ml-1">
                <button
              onClick={e => { e.stopPropagation(); onFavorite(dir.id); }}
              className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-amber-500 transition-colors"
              title="Marcar como favorita"
            >
              <Star className={`h-3.5 w-3.5 ${dir.es_favorita ? 'fill-amber-400 text-amber-400' : ''}`} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(dir.id); }}
              className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────
export const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { direcciones, guardarDireccion, eliminarDireccion, marcarFavorita, favorita } = useDirecciones();

  const cart = (location.state?.cart as CartItem[]) || [];
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [selectedDirId, setSelectedDirId] = useState<string | null>(null);
  const [saveAddress, setSaveAddress] = useState(false);
  const [addressName, setAddressName] = useState('Mi dirección');
  const [showAddresses, setShowAddresses] = useState(true);

  // Parse name from profile
  const nameParts = (profile?.nombre || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const [formData, setFormData] = useState<FormData>({
    first_name: firstName,
    last_name: lastName,
    email: profile?.email || user?.email || '',
    phone: profile?.telefono || '',
    address_1: '',
    city: '',
    postcode: '',
    notas: '',
  });

  // Pre-fill with favorite address on first load
  useEffect(() => {
    if (favorita && !selectedDirId) {
      setSelectedDirId(favorita.id);
      applyAddress(favorita);
    }
  }, [favorita]);

  const applyAddress = (dir: DireccionGuardada) => {
    setFormData(prev => ({
      ...prev,
      first_name: dir.nombre_contacto || prev.first_name,
      last_name: dir.apellidos_contacto || prev.last_name,
      email: dir.email_contacto || prev.email,
      phone: dir.telefono_contacto || prev.phone,
      address_1: dir.address_1,
      city: dir.city,
      postcode: dir.postcode,
    }));
  };

  const handleSelectDir = (dir: DireccionGuardada) => {
    setSelectedDirId(dir.id);
    applyAddress(dir);
  };

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSelectedDirId(null); // deselect saved address when editing manually
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.product.precio * item.quantity, 0);
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

    // Optionally save address
    if (saveAddress && !selectedDirId) {
      try {
        await guardarDireccion.mutateAsync({
          nombre: addressName,
          nombre_contacto: formData.first_name,
          apellidos_contacto: formData.last_name,
          email_contacto: formData.email,
          telefono_contacto: formData.phone,
          address_1: formData.address_1,
          city: formData.city,
          postcode: formData.postcode,
          country: 'ES',
          es_favorita: direcciones.length === 0, // auto-favorite if first address
        });
      } catch {
        // non-blocking
      }
    }

    setLoading(true);
    try {
      const items = cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        name: item.product.nombre,
        price: item.product.precio,
      }));

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
        const anyErr = error as any;
        const response = anyErr?.context?.response;
        if (response && typeof response.json === 'function') {
          try {
            const payload = await response.json();
            if (payload?.error) throw new Error(payload.error);
          } catch { /* fall through */ }
        }
        throw new Error('No se pudo crear el pedido. Intenta de nuevo en unos segundos.');
      }

      if (data?.payment_url) {
        setPaymentUrl(data.payment_url);
        toast({
          title: '¡Pedido creado!',
          description: `Pedido #${data.order_number} — redirigiendo al pago...`,
        });
        setTimeout(() => window.open(data.payment_url, '_blank'), 1500);
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

  // ── Payment success screen ──────────────────────────────────────────────
  if (paymentUrl) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md animate-fade-in border-0 shadow-xl">
          <CardContent className="pt-10 pb-8 text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CreditCard className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">¡Pedido Creado!</h2>
            <p className="text-muted-foreground mb-8 text-sm px-4">
              Tu pedido ha sido creado. Haz clic en el botón para completar el pago de forma segura.
            </p>
            <div className="space-y-3 px-4">
              <Button onClick={() => window.open(paymentUrl, '_blank')} className="w-full gap-2 h-12 rounded-xl text-base font-semibold" size="lg">
                <ExternalLink className="h-4 w-4" />
                Ir a Pagar
              </Button>
              <Button variant="outline" onClick={() => navigate('/store')} className="w-full rounded-xl">
                Volver a la Tienda
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-6">
              Pasarela de pago segura de Almalibre
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Checkout form ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container flex items-center h-16 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/store')} className="mr-3">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Confirmar Pedido</h1>
        </div>
      </header>

      <main className="container px-4 py-5 space-y-4 pb-32">

        {/* ── Order Summary ── */}
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-semibold">Resumen del pedido</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {cart.map(item => (
              <div key={item.product.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.product.nombre}
                  <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">×{item.quantity}</Badge>
                </span>
                <span className="font-medium">€{(item.product.precio * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t pt-2 mt-2 space-y-1.5">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>€{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Envío</span>
                <span className={subtotal > 50 ? 'text-green-600 font-medium' : ''}>
                  {subtotal > 50 ? 'Gratis 🎉' : `€${envio.toFixed(2)}`}
                </span>
              </div>
              {subtotal <= 50 && (
                <p className="text-xs text-muted-foreground bg-muted rounded-lg px-2 py-1.5">
                  Añade €{(50 - subtotal).toFixed(2)} más para envío gratis
                </p>
              )}
              <div className="flex justify-between font-bold text-base pt-1 border-t">
                <span>Total</span>
                <span className="text-primary">€{total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Saved Addresses ── */}
        {direcciones.length > 0 && (
          <Card className="border-0 shadow-sm rounded-2xl">
            <button
              className="w-full flex items-center justify-between px-4 pt-4 pb-3"
              onClick={() => setShowAddresses(v => !v)}
            >
              <span className="font-semibold text-base">Mis direcciones</span>
              {showAddresses ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {showAddresses && (
              <div className="px-4 pb-4">
                <AddressPicker
                  direcciones={direcciones}
                  selected={selectedDirId}
                  onSelect={handleSelectDir}
                  onDelete={id => eliminarDireccion.mutate(id)}
                  onFavorite={id => marcarFavorita.mutate(id)}
                />
              </div>
            )}
          </Card>
        )}

        {/* ── Contact Info ── */}
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-semibold">Datos de contacto</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="first_name" className="text-xs text-muted-foreground">Nombre *</Label>
                <Input id="first_name" value={formData.first_name} onChange={set('first_name')} placeholder="Juan" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name" className="text-xs text-muted-foreground">Apellidos</Label>
                <Input id="last_name" value={formData.last_name} onChange={set('last_name')} placeholder="García" className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">Email *</Label>
              <Input id="email" type="email" value={formData.email} onChange={set('email')} placeholder="tu@email.com" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs text-muted-foreground">Teléfono</Label>
              <Input id="phone" type="tel" value={formData.phone} onChange={set('phone')} placeholder="+34 600 000 000" className="rounded-xl" />
            </div>
          </CardContent>
        </Card>

        {/* ── Shipping Address ── */}
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Dirección de envío</CardTitle>
              {selectedDirId && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <MapPin className="h-3 w-3" /> Guardada
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="address_1" className="text-xs text-muted-foreground">Dirección *</Label>
              <Textarea
                id="address_1"
                placeholder="Calle, número, piso, puerta..."
                value={formData.address_1}
                onChange={set('address_1')}
                rows={2}
                className="rounded-xl resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-xs text-muted-foreground">Ciudad *</Label>
                <Input id="city" value={formData.city} onChange={set('city')} placeholder="Valencia" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="postcode" className="text-xs text-muted-foreground">Código Postal *</Label>
                <Input id="postcode" value={formData.postcode} onChange={set('postcode')} placeholder="46000" className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notas" className="text-xs text-muted-foreground">Notas (opcional)</Label>
              <Input id="notas" placeholder="Instrucciones de entrega, horarios..." value={formData.notas} onChange={set('notas')} className="rounded-xl" />
            </div>

            {/* Save address toggle */}
            {!selectedDirId && (
              <div
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  saveAddress ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                }`}
                onClick={() => setSaveAddress(v => !v)}
              >
                <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                  saveAddress ? 'bg-primary border-primary' : 'border-muted-foreground'
                }`}>
                  {saveAddress && <Save className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Guardar esta dirección</p>
                  <p className="text-xs text-muted-foreground">Para usarla rápidamente en futuros pedidos</p>
                </div>
              </div>
            )}

            {saveAddress && !selectedDirId && (
              <div className="space-y-1.5 animate-fade-in">
                <Label htmlFor="addressName" className="text-xs text-muted-foreground">Nombre para esta dirección</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="addressName"
                    value={addressName}
                    onChange={e => setAddressName(e.target.value)}
                    placeholder="Casa, Trabajo..."
                    className="pl-9 rounded-xl"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Submit ── */}
        <Button
          onClick={handleSubmit}
          className="w-full h-14 rounded-2xl text-base font-bold shadow-lg gap-2"
          size="lg"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <CreditCard className="h-5 w-5" />
              Continuar al Pago · €{total.toFixed(2)}
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground pb-4">
          Serás redirigido a la pasarela de pago segura de Almalibre
        </p>
      </main>
    </div>
  );
};
