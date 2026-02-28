import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, TrendingUp, TrendingDown, Lightbulb, Sparkles, RefreshCw, Euro, Target, AlertTriangle } from 'lucide-react';
import { useMaquinas } from '@/hooks/useMaquinas';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface ProfitabilityData {
  ingresosTotales: number;
  costoProductos: number;
  beneficioBruto: number;
  margenBeneficio: number;
  comparativaMesAnterior: number;
}

interface Insight {
  tipo: string;
  titulo: string;
  detalle: string;
  accion: string;
  accionDirecta?: string;
}

interface ToppingRentability {
  nombre: string;
  ventas: number;
  costo: number;
  margen: number;
  porcentajeUso: number;
  destacado?: boolean;
  alerta?: boolean;
}

export const ProfitabilityAnalysis = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { maquinas, loading: loadingMaquinas } = useMaquinas(user?.id);
  const [selectedMachine, setSelectedMachine] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('month');
  const [profitability, setProfitability] = useState<ProfitabilityData | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [toppingData, setToppingData] = useState<ToppingRentability[]>([]);
  const [projection, setProjection] = useState<{ min: number; max: number; potential: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchAnalysis();
  }, [selectedMachine, selectedPeriod, maquinas]);

  const fetchAnalysis = async () => {
    if (maquinas.length === 0) return;
    
    setLoading(true);
    setAnalyzing(true);
    
    try {
      const machineIds = selectedMachine === 'all' 
        ? maquinas.map(m => m.id)
        : [selectedMachine];
      
      const macAddresses = selectedMachine === 'all'
        ? maquinas.map(m => m.mac_address)
        : [maquinas.find(m => m.id === selectedMachine)?.mac_address];

      const { data, error } = await supabase.functions.invoke('ai-profitability-analysis', {
        body: { 
          maquinaIds: machineIds,
          macAddresses,
          periodo: selectedPeriod
        }
      });

      if (error) throw error;

      // Sanitize numeric fields - AI may return strings
      if (data.profitability) {
        const p = data.profitability;
        setProfitability({
          ingresosTotales: Number(p.ingresosTotales) || 0,
          costoProductos: Number(p.costoProductos) || 0,
          beneficioBruto: Number(p.beneficioBruto) || 0,
          margenBeneficio: Number(p.margenBeneficio) || 0,
          comparativaMesAnterior: typeof p.comparativaMesAnterior === 'string' ? 0 : Number(p.comparativaMesAnterior) || 0,
        });
      } else {
        setProfitability(null);
      }
      setInsights(data.insights || []);
      setToppingData((data.toppingData || []).map((t: any) => ({
        ...t,
        ventas: Number(t.ventas) || 0,
        costo: Number(t.costo) || 0,
        margen: typeof t.margen === 'string' ? 0 : Number(t.margen) || 0,
        porcentajeUso: Number(t.porcentajeUso) || 0,
      })));
      if (data.projection) {
        setProjection({
          min: Number(data.projection.min) || 0,
          max: Number(data.projection.max) || 0,
          potential: Number(data.projection.potential) || 0,
        });
      } else {
        setProjection(null);
      }
    } catch (error) {
      console.error('Error fetching analysis:', error);
      toast({
        title: 'Error',
        description: 'No se pudo obtener el análisis de rentabilidad',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ai')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Análisis de Rentabilidad</h1>
            <p className="text-xs text-muted-foreground">Optimiza tus ganancias</p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchAnalysis} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Filters */}
        <div className="px-4 pb-3 flex gap-2">
          <Select value={selectedMachine} onValueChange={setSelectedMachine}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Máquina" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las máquinas</SelectItem>
              {maquinas.map((maquina) => (
                <SelectItem key={maquina.id} value={maquina.id}>
                  {maquina.nombre_personalizado}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="last_month">Mes anterior</SelectItem>
              <SelectItem value="quarter">Últimos 3 meses</SelectItem>
              <SelectItem value="year">Este año</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {analyzing && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              <p className="text-sm">La IA está analizando tu rentabilidad...</p>
            </CardContent>
          </Card>
        )}

        {/* Profitability Summary */}
        {!loading && profitability && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Euro className="h-5 w-5" />
                  Rentabilidad del Período
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ingresos totales</span>
                    <span className="font-medium">{profitability.ingresosTotales.toFixed(2)}€</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Costo de productos</span>
                    <span className="font-medium">{profitability.costoProductos.toFixed(2)}€</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-medium">Beneficio bruto</span>
                    <span className="font-bold text-primary">{profitability.beneficioBruto.toFixed(2)}€</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Margen de beneficio</span>
                    <span className="font-medium">{profitability.margenBeneficio.toFixed(1)}%</span>
                  </div>
                </div>
                
                <div className={`flex items-center gap-2 text-sm ${profitability.comparativaMesAnterior >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {profitability.comparativaMesAnterior >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  <span>{profitability.comparativaMesAnterior >= 0 ? '+' : ''}{profitability.comparativaMesAnterior.toFixed(1)}% vs período anterior</span>
                </div>
              </CardContent>
            </Card>

            {/* AI Insights */}
            {insights.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-semibold flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  Insights de IA
                </h2>
                {insights.map((insight, index) => (
                  <Card key={index} className="border-l-4 border-l-primary">
                    <CardContent className="p-4">
                      <h3 className="font-medium mb-1">{insight.titulo}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{insight.detalle}</p>
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <Target className="h-4 w-4" />
                        <span>{insight.accion}</span>
                      </div>
                      {insight.accionDirecta === 'crear_codigo' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-3"
                          onClick={() => navigate('/promotions/new')}
                        >
                          🏷️ Crear código promocional
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Topping Profitability */}
            {toppingData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Rentabilidad por Topping</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground text-left">
                          <th className="pb-2">Topping</th>
                          <th className="pb-2 text-right">Ventas</th>
                          <th className="pb-2 text-right">Margen</th>
                          <th className="pb-2 text-right">% Uso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {toppingData.map((topping, index) => (
                          <tr key={index} className="border-t">
                            <td className="py-2 flex items-center gap-1">
                              {topping.nombre}
                              {topping.destacado && <span className="text-yellow-500">⭐</span>}
                              {topping.alerta && <AlertTriangle className="h-3 w-3 text-orange-500" />}
                            </td>
                            <td className="py-2 text-right">{topping.ventas.toFixed(0)}€</td>
                            <td className="py-2 text-right">{topping.margen}%</td>
                            <td className="py-2 text-right">{topping.porcentajeUso}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Projection */}
            {projection && (
              <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Proyección Próximo Mes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">Basado en tendencias actuales:</p>
                  <div className="flex justify-between">
                    <span>Beneficio estimado:</span>
                    <span className="font-medium">{projection.min.toFixed(0)}€ - {projection.max.toFixed(0)}€</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between text-primary">
                    <span>Si aplicas las sugerencias de IA:</span>
                    <span className="font-bold">{projection.potential.toFixed(0)}€ (+18%)</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {!loading && !profitability && !analyzing && (
          <Card>
            <CardContent className="p-8 text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium mb-1">Sin datos suficientes</h3>
              <p className="text-sm text-muted-foreground">
                Necesitamos más datos de ventas para generar el análisis de rentabilidad.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
};
