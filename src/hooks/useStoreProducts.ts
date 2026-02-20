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

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data?.products ?? [];
}

export function useStoreProducts() {
  return useQuery<StoreProduct[]>({
    queryKey: ['store-products'],
    queryFn: fetchProducts,
    staleTime: 15 * 60 * 1000, // 15 min — matches server cache
    gcTime: 60 * 60 * 1000,    // keep in memory 1 hour
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnMount: false,      // Don't re-fetch if cache is fresh when navigating back
  });
}
