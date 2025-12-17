import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { Card, CardContent } from '@/components/ui/card';
import { Package, TrendingUp, FileText, Sparkles } from 'lucide-react';

const aiTools = [
  {
    id: 'stock-prediction',
    path: '/ai/stock-prediction',
    icon: Package,
    title: 'Predicción de Stock',
    subtitle: 'Anticípate a la demanda',
    description: 'Saber qué pedir y cuándo',
    gradient: 'from-primary/20 to-primary/5',
  },
  {
    id: 'profitability',
    path: '/ai/profitability',
    icon: TrendingUp,
    title: 'Análisis de Rentabilidad',
    subtitle: 'Optimiza tus ganancias',
    description: 'Insights para mejorar tu margen',
    gradient: 'from-emerald-500/20 to-emerald-500/5',
  },
  {
    id: 'daily-summary',
    path: '/ai/daily-summary',
    icon: FileText,
    title: 'Resumen Diario',
    subtitle: 'Tu negocio en 30 segundos',
    description: 'Resumen inteligente cada día',
    gradient: 'from-amber-500/20 to-amber-500/5',
  },
];

export const AI = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-background px-4 pt-8 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Inteligencia Artificial</h1>
        </div>
        <p className="text-muted-foreground">
          Tu asistente inteligente para maximizar tu negocio
        </p>
      </div>

      {/* AI Tools */}
      <div className="px-4 space-y-4 mt-4">
        {aiTools.map((tool) => (
          <Card
            key={tool.id}
            className="cursor-pointer hover:shadow-lg transition-all duration-300 border-0 overflow-hidden"
            onClick={() => navigate(tool.path)}
          >
            <CardContent className={`p-0 bg-gradient-to-r ${tool.gradient}`}>
              <div className="p-5 flex items-start gap-4">
                <div className="p-3 bg-background/80 rounded-xl shadow-sm">
                  <tool.icon className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{tool.title}</h3>
                  <p className="text-primary font-medium text-sm">{tool.subtitle}</p>
                  <p className="text-muted-foreground text-sm mt-1">{tool.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Card */}
      <div className="px-4 mt-6">
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="p-4 flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">
                Nuestras herramientas de IA analizan tus datos en tiempo real para 
                darte recomendaciones personalizadas y ayudarte a tomar mejores decisiones.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};
