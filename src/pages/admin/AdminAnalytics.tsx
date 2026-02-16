import { Card, CardContent } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export const AdminAnalytics = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Analytics
        </h1>
        <p className="text-muted-foreground">Análisis avanzado de datos (próximamente)</p>
      </div>

      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">En desarrollo</p>
          <p className="text-sm mt-2">Comparativas, tendencias y predicciones estarán disponibles próximamente</p>
        </CardContent>
      </Card>
    </div>
  );
};
