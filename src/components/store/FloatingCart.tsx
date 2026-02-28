import { ShoppingCart, X, Plus, Minus, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CartItem } from '@/types/cart';

interface FloatingCartProps {
  cart: CartItem[];
  onUpdateQuantity: (productId: string, delta: number) => void;
  onClear: () => void;
}

export function FloatingCart({ cart, onUpdateQuantity, onClear }: FloatingCartProps) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);
  const total = cart.reduce((s, i) => s + i.product.precio * i.quantity, 0);

  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom)+8px)] right-4 z-50 flex flex-col items-end gap-2">
      {/* Expanded panel */}
      {expanded && (
        <div className="animate-fade-in bg-background border border-border rounded-2xl shadow-2xl w-72 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-primary/5">
            <span className="font-semibold text-sm text-foreground">Tu carrito ({itemCount})</span>
            <button onClick={() => setExpanded(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Items */}
          <div className="max-h-56 overflow-y-auto px-4 py-3 space-y-3">
            {cart.map(item => (
              <div key={item.product.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.product.nombre}</p>
                  <p className="text-xs text-muted-foreground">€{item.product.precio.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onUpdateQuantity(item.product.id, -1)}
                    className="h-6 w-6 rounded-full border flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-5 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => onUpdateQuantity(item.product.id, 1)}
                    className="h-6 w-6 rounded-full border flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t bg-muted/30">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-bold text-primary">€{total.toFixed(2)}</span>
            </div>
            <Button
              className="w-full h-10 text-sm font-semibold gap-2 rounded-xl"
              onClick={() => {
                setExpanded(false);
                navigate('/checkout', { state: { cart } });
              }}
            >
              Finalizar compra
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="relative flex items-center gap-2 bg-primary text-primary-foreground rounded-2xl shadow-lg px-4 py-3 hover:bg-primary/90 active:scale-95 transition-all duration-150"
      >
        <ShoppingCart className="h-5 w-5" />
        <span className="font-semibold text-sm">€{total.toFixed(2)}</span>
        <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs bg-destructive border-2 border-background">
          {itemCount}
        </Badge>
      </button>
    </div>
  );
}
