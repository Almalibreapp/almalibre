import { cn } from '@/lib/utils';

interface StockBarProps {
  nombre: string;
  posicion: string;
  stockActual: number;
  capacidadMaxima: number;
}

export const StockBar = ({ nombre, posicion, stockActual, capacidadMaxima }: StockBarProps) => {
  const percentage = (stockActual / capacidadMaxima) * 100;
  
  const getColor = () => {
    if (percentage <= 10) return 'bg-critical';
    if (percentage <= 20) return 'bg-warning';
    return 'bg-success';
  };

  const getTextColor = () => {
    if (percentage <= 10) return 'text-critical';
    if (percentage <= 20) return 'text-warning';
    return 'text-success';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{nombre}</span>
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
