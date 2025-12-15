import { IceCream } from 'lucide-react';

export const SplashScreen = () => {
  return (
    <div className="fixed inset-0 bg-primary flex flex-col items-center justify-center">
      <div className="animate-pulse-slow">
        <IceCream className="h-20 w-20 text-primary-foreground mb-6" />
      </div>
      <h1 className="text-2xl font-bold text-primary-foreground mb-2">
        Almalibre Franquicias
      </h1>
      <p className="text-primary-foreground/80 text-sm">
        Cargando...
      </p>
    </div>
  );
};
