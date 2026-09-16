import { useState, useEffect } from 'react';
import { Download, Calendar, Database, Thermometer, ShoppingCart, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, differenceInDays, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { dedupeMaquinasByImei } from '@/lib/maquinas';
import {
  enumerateDates,
  fetchVentasParaExportar,
  fetchTemperaturasParaExportar,
  buildVentasWorkbook,
  buildTemperaturaWorkbook,
} from '@/lib/export-data';

interface Maquina {
  id: string;
  mac_address: string;
  nombre_personalizado: string;
  ubicacion: string | null;
  usuario_id: string;
}

export const AdminExportData = () => {
  const [tipo, setTipo] = useState<'ventas' | 'temperatura' | null>(null);
  const [desde, setDesde] = useState<Date | undefined>();
  const [hasta, setHasta] = useState<Date | undefined>();
  const [imei, setImei] = useState<string>('');
  const [downloading, setDownloading] = useState(false);
  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [loadingMaquinas, setLoadingMaquinas] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const { data } = await supabase.from('maquinas').select('*').order('nombre_personalizado');
      setMaquinas(dedupeMaquinasByImei((data as Maquina[]) || []));
      setLoadingMaquinas(false);
    };
    fetchAll();
  }, []);

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
      const selectedImei = imei.trim();
      const dias = enumerateDates(desdeStr, hastaStr);

      let wb: XLSX.WorkBook;

      if (tipo === 'temperatura') {
        const rows = await fetchTemperaturasParaExportar(selectedImei, dias);
        if (rows.length === 0) {
          toast.error('No hay datos de temperatura en el rango seleccionado');
          setDownloading(false);
          return;
        }
        wb = buildTemperaturaWorkbook(rows, dias);
      } else {
        const rows = await fetchVentasParaExportar(selectedImei, desdeStr, hastaStr);
        if (rows.length === 0) {
          toast.error('No hay ventas en el rango seleccionado');
          setDownloading(false);
          return;
        }
        wb = buildVentasWorkbook(rows, dias);
      }

      XLSX.writeFile(wb, `${tipo}_${selectedImei}_${desdeStr}_${hastaStr}.xlsx`);
      toast.success('Archivo descargado correctamente');
    } catch (err) {
      console.error('[AdminExportData] Error:', err);
      toast.error('Error al generar el archivo');
    } finally {
      setDownloading(false);
    }
  };

  const maquinaSeleccionada = maquinas.find(m => m.mac_address === imei);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Exportar Datos</h1>
        <p className="text-muted-foreground">Descarga históricos de ventas o temperatura en Excel</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5 max-w-3xl">
        <Card className="md:col-span-2">
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Desde
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !desde && 'text-muted-foreground')}>
                  <Calendar className="mr-2 h-4 w-4" />
                  {desde ? format(desde, 'dd/MM/yyyy') : 'Seleccionar fecha'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent mode="single" selected={desde} onSelect={setDesde} disabled={(date) => isFuture(date)} locale={es} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Hasta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !hasta && 'text-muted-foreground')}>
                  <Calendar className="mr-2 h-4 w-4" />
                  {hasta ? format(hasta, 'dd/MM/yyyy') : 'Seleccionar fecha'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent mode="single" selected={hasta} onSelect={setHasta} disabled={(date) => isFuture(date)} locale={es} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>

        {desde && hasta && desde > hasta && (
          <p className="text-xs text-destructive flex items-center gap-1 md:col-span-2">
            <AlertCircle className="h-3 w-3" /> La fecha "Desde" debe ser anterior o igual a "Hasta"
          </p>
        )}
        {rangoExcedido && (
          <p className="text-xs text-destructive flex items-center gap-1 md:col-span-2">
            <AlertCircle className="h-3 w-3" /> El rango máximo es de 60 días ({rangoDias} seleccionados)
          </p>
        )}
        {rangoGrande && !rangoExcedido && (
          <p className="text-xs text-amber-500 flex items-center gap-1 md:col-span-2">
            <AlertCircle className="h-3 w-3" /> Rango de {rangoDias} días — la descarga puede tardar
          </p>
        )}

        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Máquina
            </CardTitle>
            <CardDescription>Se muestran todas las máquinas del sistema</CardDescription>
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

        <Card className="md:col-span-2">
          <CardContent className="pt-6 space-y-4">
            {formCompleto && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Tipo:</span> <Badge variant="outline">{tipo === 'ventas' ? 'Ventas' : 'Temperatura'}</Badge></p>
                <p><span className="text-muted-foreground">Máquina:</span> {maquinaSeleccionada?.nombre_personalizado}</p>
                <p><span className="text-muted-foreground">Periodo:</span> {format(desde!, 'dd/MM/yyyy')} → {format(hasta!, 'dd/MM/yyyy')} ({rangoDias} días)</p>
              </div>
            )}
            <Button className="w-full" size="lg" disabled={!formCompleto || downloading} onClick={handleDownload}>
              {downloading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Descargando...</>
              ) : (
                <><Download className="h-4 w-4 mr-2" /> Descargar Excel</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
