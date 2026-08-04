import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StoreProduct {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  categoria: string;
  categoria_id: number | null;
  imagen_url: string | null;
  stock_disponible: number | null;
  en_stock?: boolean;
  sku?: string | null;
}

async function fetchProducts(): Promise<StoreProduct[]> {
  const { data, error } = await supabase.functions.invoke('woocommerce-products', {
    body: {},
  });

  if (error) {
    console.error('[store] woocommerce-products invoke error:', error);
    throw error;
  }
  if (data?.error) throw new Error(data.error);

  const products = (data?.products ?? []) as StoreProduct[];
  // An empty list means something went wrong upstream — fail so react-query retries
  // instead of caching a blank store.
  if (products.length === 0) throw new Error('No se recibieron productos de la tienda');

  return products;
}

export function useStoreProducts() {
  return useQuery<StoreProduct[]>({
    queryKey: ['store-products-v2'],
    queryFn: fetchProducts,
    staleTime: 15 * 60 * 1000,  // 15 min — matches server cache
    gcTime: 60 * 60 * 1000,     // keep in memory 1 hour
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',    // never render a stale/empty store on entry
    refetchOnReconnect: true,
  });
}

