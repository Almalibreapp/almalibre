import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

interface ProductsResponse {
  products: Product[];
  hasMore: boolean;
  total: number;
  page: number;
  cached?: boolean;
}

async function fetchProducts(): Promise<Product[]> {
  // Fetch all products in one call (the edge function caches server-side too)
  const { data, error } = await supabase.functions.invoke('woocommerce-products', {
    body: { page: 1, per_page: 100 },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data?.products ?? [];
}

export function useStoreProducts() {
  return useQuery<Product[]>({
    queryKey: ['store-products'],
    queryFn: fetchProducts,
    staleTime: 10 * 60 * 1000, // 10 min — matches server cache
    gcTime: 30 * 60 * 1000,    // keep in memory 30 min
    retry: 2,
    refetchOnWindowFocus: false,
  });
}
