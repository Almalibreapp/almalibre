import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, RefreshCw, Euro, ShoppingBag, TrendingUp, Clock, Sparkles, AlertTriangle, Package, FileText, Lightbulb, CheckSquare } from 'lucide-react';
import { useMaquinas } from '@/hooks/useMaquinas';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MachineStatus {
  nombre: string;
  online: boolean;
  temperatura: number;
  ventasAyer: number;
  cantidadVentas: number;
  alertasStock: { nombre: string; porcentaje: number }[];
}

interface DailySummaryData {
  fecha: string;
  metricas: {
    ingresosTotales: number;
    ventasTotales: number;
    ticketPromedio: number;
    comparativaAyer: number;
    horaPico: string;
    toppingEstrella: string;
  };
  estadoMaquinas: MachineStatus[];
  alertas: { tipo: string; mensaje: string; accion: string }[];
  insights: string[];
  accionesSugeridas: string[];
  semana: { dia: string; ingresos: number }[];
  metaSemana: number;
  totalSemana: number;
}

export const DailySummary = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, user } = useAuth();
  const { maquinas } = useMaquinas(user?.id);
  const [summary, setSummary] = useState<DailySummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (maquinas.length > 0) {
      fetchSummary();
    }
  }, [maquinas]);

  const fetchSummary = async () => {
    setLoading(true);
    setAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-daily-summary', {
        body: { 
          maquinaIds: maquinas.map(m => m.id),
          macAddresses: maquinas.map(m => m.mac_address)
        }
      });

      if (error) throw error;
      setSummary(data);
    } catch (error) {
      console.error('Error fetching summary:', error);
      toast({
        title: 'Error',
        description: 'No se pudo obtener el resumen diario',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const today = new Date();
  const formattedDate = format(today, "EEEE, d 'de' MMMM yyyy", { locale: es });
  const greeting = today.getHours() < 12 ? 'Buenos días' : today.getHours() < 20 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ai')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Resumen Diario</h1>
            <p className="text-xs text-muted-foreground capitalize">{formattedDate}</p>
          </div>
          <Button variant="outline" size="icon" onClick={fetchSummary} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Greeting */}
        <div className="bg-gradient-to-r from-primary/10 to-transparent p-4 rounded-xl">
          <p className="text-lg font-medium">
            {greeting}, {profile?.nombre?.split(' ')[0] || 'Usuario'} 👋
          </p>
        </div>

        {analyzing && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              <p className="text-sm">La IA está preparando tu resumen del día...</p>
            </CardContent>
          </Card>
        )}

        {!loading && summary && (
          <>
            {/* Quick Stats */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Tu día en 30 segundos
                </CardTitle>
                <p className="text-xs text-muted-foreground">Ayer, {summary.fecha}</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <Euro className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-lg font-bold">{summary.metricas.ingresosTotales.toFixed(2)}€</p>
                    <p className="text-xs text-muted-foreground">Ingresos</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <ShoppingBag className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-lg font-bold">{summary.metricas.ventasTotales}</p>
                    <p className="text-xs text-muted-foreground">Ventas</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <TrendingUp className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className={`text-lg font-bold ${summary.metricas.comparativaAyer >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {summary.metricas.comparativaAyer >= 0 ? '+' : ''}{summary.metricas.comparativaAyer}%
                    </p>
                    <p className="text-xs text-muted-foreground">vs ayer</p>
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span>🎯</span>
                    <span>Ticket promedio: <strong>{summary.metricas.ticketPromedio.toFixed(2)}€</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Hora pico: <strong>{summary.metricas.horaPico}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>⭐</span>
                    <span>Topping estrella: <strong>{summary.metricas.toppingEstrella}</strong></span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Machine Status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Estado de tus Máquinas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {summary.estadoMaquinas.map((maquina, index) => (
                  <div key={index} className="p-3 bg-muted/30 rounded-lg">
                    <div className="font-medium mb-2">{maquina.nombre}</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${maquina.online ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span>{maquina.online ? 'Online' : 'Offline'} | {maquina.temperatura.toFixed(1)}°C ✓</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Euro className="h-3 w-3" />
                        <span>Ayer: {maquina.ventasAyer.toFixed(2)}€ ({maquina.cantidadVentas} ventas)</span>
                      </div>
                      {maquina.alertasStock.length > 0 ? (
                        <div className="flex items-center gap-2 text-orange-500">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Stock bajo: {maquina.alertasStock.map(a => `${a.nombre} (${a.porcentaje}%)`).join(', ')}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-green-500">
                          <span>✅ Stock OK</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Alerts */}
            {summary.alertas.length > 0 && (
              <Card className="border-orange-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-orange-500">
                    <AlertTriangle className="h-5 w-5" />
                    Requiere tu Atención
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {summary.alertas.map((alerta, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{alerta.tipo}</p>
                        <p className="text-xs text-muted-foreground">{alerta.mensaje}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate('/store')}>
                        {alerta.accion}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* AI Insights */}
            {summary.insights.length > 0 && (
              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-yellow-500" />
                    Lo que la IA detectó hoy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {summary.insights.map((insight, index) => (
                    <p key={index} className="text-sm text-muted-foreground">"{insight}"</p>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Suggested Actions */}
            {summary.accionesSugeridas.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-green-500" />
                    Sugerencias para hoy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {summary.accionesSugeridas.map((accion, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 border rounded flex-shrink-0" />
                      <span>{accion}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Weekly Progress */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Tu Semana
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-end gap-1 h-20 mb-2">
                  {summary.semana.map((dia, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div 
                        className={`w-full rounded-t ${dia.ingresos > 0 ? 'bg-primary' : 'bg-muted'}`}
                        style={{ height: `${Math.max(10, (dia.ingresos / (summary.metaSemana / 7)) * 50)}px` }}
                      />
                      <span className="text-xs text-muted-foreground mt-1">{dia.dia}</span>
                    </div>
                  ))}
                </div>
                <div className="text-sm">
                  <span>Total semana: <strong>{summary.totalSemana.toFixed(0)}€</strong></span>
                  <span className="text-muted-foreground"> (meta: {summary.metaSemana}€)</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 mt-2">
                  <div 
                    className="bg-primary h-2 rounded-full" 
                    style={{ width: `${Math.min(100, (summary.totalSemana / summary.metaSemana) * 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {!loading && !summary && !analyzing && (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium mb-1">Sin datos suficientes</h3>
              <p className="text-sm text-muted-foreground">
                Necesitamos más datos de ventas para generar el resumen diario.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  );
};
