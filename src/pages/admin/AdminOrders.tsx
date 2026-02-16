import { Card, CardContent } from '@/components/ui/card';
import { ShoppingCart } from 'lucide-react';

export const AdminOrders = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <ShoppingCart className="h-6 w-6" /> Pedidos WooCommerce
        </h1>
        <p className="text-muted-foreground">Gestión de pedidos de materias primas (próximamente)</p>
      </div>

      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">En desarrollo</p>
          <p className="text-sm mt-2">La integración con pedidos WooCommerce estará disponible próximamente</p>
        </CardContent>
      </Card>
    </div>
  );
};
