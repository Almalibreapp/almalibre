import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Calendar, Database, Thermometer, ShoppingCart, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, differenceInDays, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useMaquinas } from '@/hooks/useMaquinas';
import { toast } from 'sonner';
import { API_CONFIG } from '@/config/api';
import { BottomNav } from '@/components/layout/BottomNav';

export const ExportData = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { maquinas, loading: loadingMaquinas } = useMaquinas(user?.id);

  const [tipo, setTipo] = useState<'ventas' | 'temperatura' | null>(null);
  const [desde, setDesde] = useState<Date | undefined>();
  const [hasta, setHasta] = useState<Date | undefined>();
  const [imei, setImei] = useState<string>('');
  const [downloading, setDownloading] = useState(false);

  const rangoValido = desde && hasta && desde <= hasta;
  const rangoDias = desde && hasta ? differenceInDays(hasta, desde) : 0;
  const rangoExcedido = rangoDias > 60;
  const rangoGrande = rangoDias > 30;
  const formCompleto = tipo && desde && hasta && imei && rangoValido && !rangoExcedido;

  const handleDownload = async () => {
    if (!formCompleto) return;
    setDownloading(true);
    try {
      const desdeStr = format(desde!, 'yyyy-MM-dd');
      const hastaStr = format(hasta!, 'yyyy-MM-dd');
      const url = `${API_CONFIG.endpoints.ventas.replace('/ventas', '/exportar-datos')}?tipo=${tipo}&imei=${imei}&desde=${desdeStr}&hasta=${hastaStr}`;

      const response = await fetch(url, { headers: API_CONFIG.headers });

      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${tipo}_${imei}_${desdeStr}_${hastaStr}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
        toast.success('Archivo descargado correctamente');
      } else {
        const error = await response.json().catch(() => ({ message: 'Error desconocido' }));
        toast.error(error.message || 'Error al descargar el archivo');
      }
    } catch {
      toast.error('Error de conexión al descargar');
    } finally {
      setDownloading(false);
    }
  };

  const maquinaSeleccionada = maquinas.find(m => m.mac_address === imei);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="container flex items-center gap-3 h-14 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-display font-bold text-lg">Exportar Datos</h1>
            <p className="text-xs text-muted-foreground">Descarga históricos en Excel</p>
          </div>
        </div>
      </div>

      <div className="container px-4 py-6 space-y-5 max-w-lg mx-auto">
        {/* Tipo de datos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Tipo de Datos
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3">
            <button
              onClick={() => setTipo('ventas')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all text-sm font-medium',
                tipo === 'ventas'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <ShoppingCart className="h-5 w-5" />
              Ventas
            </button>
            <button
              onClick={() => setTipo('temperatura')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all text-sm font-medium',
                tipo === 'temperatura'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <Thermometer className="h-5 w-5" />
              Temperatura
            </button>
          </CardContent>
        </Card>

        {/* Fechas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Rango de Fechas
            </CardTitle>
            <CardDescription>Máximo 60 días</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Desde</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal text-sm', !desde && 'text-muted-foreground')}>
                      <Calendar className="mr-2 h-4 w-4" />
                      {desde ? format(desde, 'dd/MM/yyyy') : 'Inicio'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={desde}
                      onSelect={setDesde}
                      disabled={(date) => isFuture(date)}
                      locale={es}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Hasta</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal text-sm', !hasta && 'text-muted-foreground')}>
                      <Calendar className="mr-2 h-4 w-4" />
                      {hasta ? format(hasta, 'dd/MM/yyyy') : 'Fin'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={hasta}
                      onSelect={setHasta}
                      disabled={(date) => isFuture(date)}
                      locale={es}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {desde && hasta && desde > hasta && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> La fecha "Desde" debe ser anterior a "Hasta"
              </p>
            )}
            {rangoExcedido && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> El rango máximo es de 60 días ({rangoDias} seleccionados)
              </p>
            )}
            {rangoGrande && !rangoExcedido && (
              <p className="text-xs text-amber-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Rango de {rangoDias} días — la descarga puede tardar
              </p>
            )}
          </CardContent>
        </Card>

        {/* Máquina */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Máquina
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={imei} onValueChange={setImei}>
              <SelectTrigger>
                <SelectValue placeholder={loadingMaquinas ? 'Cargando...' : 'Selecciona una máquina'} />
              </SelectTrigger>
              <SelectContent>
                {maquinas.map((m) => (
                  <SelectItem key={m.id} value={m.mac_address}>
                    {m.nombre_personalizado} — {m.ubicacion || 'Sin ubicación'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Resumen + Botón */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            {formCompleto && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Tipo:</span> <Badge variant="outline">{tipo === 'ventas' ? 'Ventas' : 'Temperatura'}</Badge></p>
                <p><span className="text-muted-foreground">Máquina:</span> {maquinaSeleccionada?.nombre_personalizado}</p>
                <p><span className="text-muted-foreground">Periodo:</span> {format(desde!, 'dd/MM/yyyy')} → {format(hasta!, 'dd/MM/yyyy')} ({rangoDias} días)</p>
              </div>
            )}
            <Button
              className="w-full"
              size="lg"
              disabled={!formCompleto || downloading}
              onClick={handleDownload}
            >
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Descargando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Excel
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};
