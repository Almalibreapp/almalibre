import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Package, ShoppingCart, AlertTriangle, Clock, TrendingDown, Sparkles, RefreshCw } from 'lucide-react';
import { useMaquinas } from '@/hooks/useMaquinas';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface StockPrediction {
  topping: string;
  porcentaje: number;
  consumoPromedio: number;
  diasRestantes: number;
  fechaAgotamiento: string;
  urgencia: 'normal' | 'pronto' | 'urgente' | 'critico';
  recomendacion: string;
}

interface SuggestedOrder {
  topping: string;
  cantidad: string;
  precio: number;
  urgencia: string;
}

export const StockPrediction = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { maquinas, loading: loadingMaquinas } = useMaquinas(user?.id);
  const [selectedMachine, setSelectedMachine] = useState<string>('');
  const [predictions, setPredictions] = useState<StockPrediction[]>([]);
  const [suggestedOrder, setSuggestedOrder] = useState<SuggestedOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (maquinas.length > 0 && !selectedMachine) {
      setSelectedMachine(maquinas[0].id);
    }
  }, [maquinas]);

  useEffect(() => {
    if (selectedMachine) {
      fetchPredictions();
    }
  }, [selectedMachine]);

  const fetchPredictions = async () => {
    setLoading(true);
    setAnalyzing(true);
    
    try {
      const machine = maquinas.find(m => m.id === selectedMachine);
      if (!machine) return;

      // Call AI edge function for predictions
      const { data, error } = await supabase.functions.invoke('ai-stock-prediction', {
        body: { 
          maquinaId: selectedMachine,
          macAddress: machine.mac_address 
        }
      });

      if (error) throw error;

      setPredictions(data.predictions || []);
      setSuggestedOrder(data.suggestedOrder || []);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron obtener las predicciones',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const getUrgencyColor = (urgencia: string) => {
    switch (urgencia) {
      case 'critico': return 'text-red-500';
      case 'urgente': return 'text-orange-500';
      case 'pronto': return 'text-yellow-500';
      default: return 'text-green-500';
    }
  };

  const getUrgencyBg = (urgencia: string) => {
    switch (urgencia) {
      case 'critico': return 'bg-red-500';
      case 'urgente': return 'bg-orange-500';
      case 'pronto': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  const getUrgencyIcon = (urgencia: string) => {
    switch (urgencia) {
      case 'critico':
      case 'urgente':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const totalSugerido = suggestedOrder.reduce((acc, item) => acc + item.precio, 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ai')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Predicción de Stock</h1>
            <p className="text-xs text-muted-foreground">Anticípate a la demanda</p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchPredictions} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Machine Selector */}
        {maquinas.length > 1 && (
          <div className="px-4 pb-3">
            <Select value={selectedMachine} onValueChange={setSelectedMachine}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una máquina" />
              </SelectTrigger>
              <SelectContent>
                {maquinas.map((maquina) => (
                  <SelectItem key={maquina.id} value={maquina.id}>
                    {maquina.nombre_personalizado}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {analyzing && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              <p className="text-sm">La IA está analizando tus datos de ventas...</p>
            </CardContent>
          </Card>
        )}

        {/* Predictions */}
        {!loading && predictions.length > 0 && (
          <>
            <div className="space-y-3">
              {predictions.map((pred, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getUrgencyBg(pred.urgencia)}`} />
                        <h3 className="font-semibold">{pred.topping}</h3>
                      </div>
                      <span className="text-lg font-bold">{pred.porcentaje}%</span>
                    </div>
                    
                    <Progress value={pred.porcentaje} className="h-2 mb-3" />
                    
                    <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" />
                        <span>{pred.consumoPromedio} porciones/día</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>~{pred.diasRestantes} días</span>
                      </div>
                    </div>

                    <div className={`flex items-center gap-2 text-sm ${getUrgencyColor(pred.urgencia)}`}>
                      {getUrgencyIcon(pred.urgencia)}
                      <span className="font-medium">{pred.recomendacion}</span>
                    </div>

                    {(pred.urgencia === 'critico' || pred.urgencia === 'urgente') && (
                      <Button 
                        className="w-full mt-3" 
                        size="sm"
                        onClick={() => navigate('/store')}
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Añadir pedido
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Suggested Order */}
            {suggestedOrder.length > 0 && (
              <Card className="border-primary bg-gradient-to-br from-primary/10 to-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Pedido Sugerido por IA
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Basado en tu consumo de los últimos 30 días, te recomiendo pedir:
                  </p>
                  
                  <div className="space-y-2">
                    {suggestedOrder.map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span>• {item.topping} ({item.cantidad})</span>
                          {item.urgencia === 'URGENTE' && (
                            <span className="text-xs bg-red-500/10 text-red-500 px-2 py-0.5 rounded">
                              URGENTE
                            </span>
                          )}
                        </div>
                        <span className="font-medium">{item.precio.toFixed(2)}€</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t flex items-center justify-between">
                    <span className="font-medium">Total sugerido:</span>
                    <span className="text-lg font-bold text-primary">{totalSugerido.toFixed(2)}€</span>
                  </div>

                  <Button className="w-full" onClick={() => navigate('/store')}>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Crear pedido con estas sugerencias
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {!loading && predictions.length === 0 && !analyzing && (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium mb-1">Sin datos suficientes</h3>
              <p className="text-sm text-muted-foreground">
                Necesitamos más datos de ventas para generar predicciones precisas.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
};
