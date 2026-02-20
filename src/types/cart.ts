import type { StoreProduct } from '@/hooks/useStoreProducts';

export interface CartItem {
  product: StoreProduct;
  quantity: number;
}
