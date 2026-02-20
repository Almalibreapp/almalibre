import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/layout/BottomNav';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Minus, Package, AlertCircle, ShoppingBag } from 'lucide-react';
import { ProductImage } from '@/components/store/ProductImage';
import { Skeleton } from '@/components/ui/skeleton';
import { FloatingCart } from '@/components/store/FloatingCart';
import { useStoreProducts, type StoreProduct } from '@/hooks/useStoreProducts';
import type { CartItem } from '@/types/cart';

export const Store = () => {
  const { toast } = useToast();
  const { data: products = [], isLoading, isError } = useStoreProducts();

  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      p.descripcion?.toLowerCase().includes(q) ||
      p.categoria.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  const getCartQuantity = (productId: string) =>
    cart.find(i => i.product.id === productId)?.quantity ?? 0;

  const addToCart = (product: StoreProduct) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    toast({ title: '¡Añadido!', description: product.nombre, duration: 1500 });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(item =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item,
        )
        .filter(item => item.quantity > 0),
    );
  };

  const ProductSkeleton = () => (
    <Card className="overflow-hidden border-0 shadow-sm">
      <div className="aspect-square">
        <Skeleton className="w-full h-full" />
      </div>
      <CardContent className="p-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">Tienda</h1>
              {products.length > 0 && !isLoading && (
                <p className="text-xs text-muted-foreground">{products.length} productos disponibles</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos..."
              className="pl-10 rounded-xl border-muted bg-muted/40"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Products Grid */}
      <main className="container px-4 py-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => <ProductSkeleton key={i} />)}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-muted-foreground text-center">
              No se pudo cargar la tienda.<br />Comprueba tu conexión e inténtalo de nuevo.
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Package className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? 'No se encontraron productos' : 'La tienda está vacía'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map(product => {
              const qty = getCartQuantity(product.id);
              return (
                <Card
                  key={product.id}
                  className="overflow-hidden border-0 shadow-sm bg-card rounded-2xl"
                >
                  {/* Image */}
                  <div className="aspect-square bg-muted relative">
                    <ProductImage src={product.imagen_url} alt={product.nombre} />
                    {qty > 0 && (
                      <Badge className="absolute top-2 right-2 h-6 w-6 p-0 flex items-center justify-center text-xs rounded-full bg-primary border-2 border-background shadow">
                        {qty}
                      </Badge>
                    )}
                  </div>

                  <CardContent className="p-3 pt-2">
                    <h3 className="font-semibold text-sm line-clamp-2 mb-0.5 leading-tight">
                      {product.nombre}
                    </h3>
                    {product.descripcion && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                        {product.descripcion}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-1">
                      <span className="font-bold text-primary text-base">
                        €{product.precio.toFixed(2)}
                      </span>

                      {qty === 0 ? (
                        <Button
                          size="sm"
                          className="h-8 px-3 rounded-xl text-xs font-semibold gap-1 shadow-sm"
                          onClick={() => addToCart(product)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Añadir
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1.5 bg-primary/10 rounded-xl px-1.5 py-0.5">
                          <button
                            onClick={() => updateQuantity(product.id, -1)}
                            className="h-6 w-6 rounded-lg flex items-center justify-center hover:bg-primary/20 transition-colors"
                          >
                            <Minus className="h-3.5 w-3.5 text-primary" />
                          </button>
                          <span className="w-4 text-center text-sm font-bold text-primary">
                            {qty}
                          </span>
                          <button
                            onClick={() => addToCart(product)}
                            className="h-6 w-6 rounded-lg flex items-center justify-center hover:bg-primary/20 transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5 text-primary" />
                          </button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Cart */}
      <FloatingCart
        cart={cart}
        onUpdateQuantity={updateQuantity}
        onClear={() => setCart([])}
      />

      <BottomNav />
    </div>
  );
};
