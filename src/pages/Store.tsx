import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BottomNav } from '@/components/layout/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, Search, Plus, Minus, Loader2, Package } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ProductImage } from '@/components/store/ProductImage';
import { Skeleton } from '@/components/ui/skeleton';

interface Product {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  categoria: string;
  imagen_url: string | null;
  stock_disponible: number | null;
  en_stock?: boolean;
}

interface CartItem {
  product: Product;
  quantity: number;
}

const categories = [
  { value: 'all', label: 'Todos' },
  { value: 'acai', label: 'Açaí' },
  { value: 'toppings', label: 'Toppings' },
  { value: 'consumibles', label: 'Consumibles' },
  { value: 'merchandising', label: 'Merchandising' },
];

const PRODUCTS_PER_PAGE = 12;

export const Store = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setProducts([]);
    setPage(1);
    setHasMore(true);
    fetchProducts(1, true);
  }, [activeCategory]);

  const fetchProducts = async (pageNum: number, reset: boolean = false, retryCount = 0) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('woocommerce-products', {
        body: { page: pageNum, per_page: PRODUCTS_PER_PAGE },
      });
      
      if (error) throw error;
      
      if (data?.products) {
        if (reset) {
          setProducts(data.products);
        } else {
          setProducts(prev => [...prev, ...data.products]);
        }
        setHasMore(data.hasMore ?? false);
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      
      // Retry up to 2 times on failure (for 502 errors)
      if (retryCount < 2) {
        console.log(`Retrying... attempt ${retryCount + 1}`);
        setTimeout(() => fetchProducts(pageNum, reset, retryCount + 1), 1000);
        return;
      }
      
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los productos. Intenta de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchProducts(nextPage, false);
    }
  }, [loadingMore, hasMore, page]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loadingMore, loading, loadMore]);

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.nombre.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'all' || 
      product.categoria.toLowerCase().includes(activeCategory.toLowerCase());
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    toast({
      title: 'Añadido al carrito',
      description: product.nombre,
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.product.precio * item.quantity,
    0
  );

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    navigate('/checkout', { state: { cart } });
  };

  // Skeleton loader for products grid
  const ProductSkeleton = () => (
    <Card className="overflow-hidden">
      <div className="aspect-square">
        <Skeleton className="w-full h-full" />
      </div>
      <CardContent className="p-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-32">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="container px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold">Tienda</h1>
              <Skeleton className="h-9 w-9" />
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="px-4 pb-2">
            <Skeleton className="h-10 w-full" />
          </div>
        </header>
        <main className="container px-4 py-6">
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">Tienda</h1>
            <Button
              variant="outline"
              size="sm"
              className="relative"
              onClick={() => setShowCart(!showCart)}
            >
              <ShoppingCart className="h-5 w-5" />
              {cartItemCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {cartItemCount}
                </Badge>
              )}
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="px-4 pb-2">
          <TabsList className="w-full justify-start overflow-x-auto">
            {categories.map((cat) => (
              <TabsTrigger key={cat.value} value={cat.value} className="flex-shrink-0">
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>

      {/* Cart Drawer */}
      {showCart && cart.length > 0 && (
        <div className="fixed inset-x-0 top-[140px] z-20 bg-background border-b shadow-lg animate-slide-up">
          <div className="container px-4 py-4 max-h-[300px] overflow-y-auto">
            <h3 className="font-semibold mb-3">Tu Carrito</h3>
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.product.id} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.product.nombre}</p>
                    <p className="text-sm text-muted-foreground">
                      €{item.product.precio.toFixed(2)} x {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(item.product.id, -1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => updateQuantity(item.product.id, 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold">Total:</span>
                <span className="text-lg font-bold">€{cartTotal.toFixed(2)}</span>
              </div>
              <Button className="w-full" onClick={handleCheckout}>
                Realizar Pedido
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Products Grid */}
      <main className="container px-4 py-6">
        {filteredProducts.length === 0 && !loadingMore ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Package className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No se encontraron productos</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              {filteredProducts.map((product) => (
                <Card key={product.id} className="overflow-hidden animate-fade-in">
                  <div className="aspect-square bg-muted">
                    <ProductImage 
                      src={product.imagen_url} 
                      alt={product.nombre} 
                    />
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-medium text-sm line-clamp-2 mb-1">
                      {product.nombre}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {product.descripcion}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-primary">
                        €{product.precio.toFixed(2)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() => addToCart(product)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Infinite scroll trigger */}
            <div ref={loadMoreRef} className="py-8 flex justify-center">
              {loadingMore && (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              )}
              {!hasMore && products.length > 0 && (
                <p className="text-sm text-muted-foreground">No hay más productos</p>
              )}
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
};
