import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle } from 'lucide-react';

interface StockBarProps {
  nombre: string;
  posicion: string;
  stockActual: number;
  capacidadMaxima: number;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (posicion: string, selected: boolean) => void;
}

export const StockBar = ({ 
  nombre, 
  posicion, 
  stockActual, 
  capacidadMaxima,
  selectable = false,
  selected = false,
  onSelect
}: StockBarProps) => {
  const percentage = capacidadMaxima > 0 ? (stockActual / capacidadMaxima) * 100 : 0;
  
  // Crítico al 25% o menos
  const isCritical = percentage <= 25;

  const getColor = () => {
    if (percentage <= 25) return 'bg-critical';
    if (percentage <= 40) return 'bg-warning';
    return 'bg-success';
  };

  const getTextColor = () => {
    if (percentage <= 25) return 'text-critical';
    if (percentage <= 40) return 'text-warning';
    return 'text-success';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {selectable && (
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onSelect?.(posicion, checked === true)}
              className="data-[state=checked]:bg-primary"
            />
          )}
          <span className="font-medium">{nombre}</span>
          {isCritical && (
            <span className="flex items-center gap-1 text-xs text-critical font-medium">
              <AlertTriangle className="h-3 w-3" />
              Crítico
            </span>
          )}
        </div>
        <span className={cn("font-semibold", getTextColor())}>
          {stockActual}/{capacidadMaxima}
        </span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-500", getColor())}
          style={{ width: `${Math.max(percentage, 2)}%` }}
        />
      </div>
    </div>
  );
};
