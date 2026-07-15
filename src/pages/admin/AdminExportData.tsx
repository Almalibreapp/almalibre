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
import { fetchTemperatura, fetchOrdenes } from '@/services/api';
import { convertirVentaAEspana } from '@/lib/timezone-utils';

interface Maquina {
  id: string;
  mac_address: string;
  nombre_personalizado: string;
  ubicacion: string | null;
  usuario_id: string;
}

const PASTEURIZATION_MIN = 66;

const addDaysISO = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

const enumerateDates = (fromISO: string, toISO: string) => {
  const out: string[] = [];
  let cur = fromISO;
  while (cur <= toISO) {
    out.push(cur);
    cur = addDaysISO(cur, 1);
  }
  return out;
};

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
      setMaquinas((data as Maquina[]) || []);
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
      const dias = enumerateDates(desdeStr, hastaStr);

      const wb = XLSX.utils.book_new();

      if (tipo === 'temperatura') {
        const rows: Array<Record<string, unknown>> = [];
        for (const dia of dias) {
          const data = await fetchTemperatura(imei, dia, dia);
          const datos = Array.isArray(data?.datos) ? data.datos : [];
          for (const d of datos) {
            const tsRaw = String(d.timestamp || '').trim();
            let fecha = dia;
            let hora = tsRaw;
            const m = tsRaw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/);
            if (m) {
              fecha = m[1];
              hora = m[2];
            } else if (/^\d{2}:\d{2}/.test(tsRaw)) {
              hora = tsRaw;
            }
            const temp = Number(d.temperatura);
            const esPico = Number.isFinite(temp) && temp >= PASTEURIZATION_MIN;
            rows.push({
              Fecha: fecha,
              Hora: hora,
              'Temperatura (°C)': Number.isFinite(temp) ? temp : '',
              Estado: d.estado || '',
              Sensor: d.sensor || '',
              Pasteurización: esPico ? `SÍ (≥${PASTEURIZATION_MIN}°C)` : '',
            });
          }
        }

        if (rows.length === 0) {
          toast.error('No hay datos de temperatura en el rango seleccionado');
          setDownloading(false);
          return;
        }

        rows.sort((a, b) => {
          const ka = `${a.Fecha} ${a.Hora}`;
          const kb = `${b.Fecha} ${b.Hora}`;
          return ka < kb ? -1 : ka > kb ? 1 : 0;
        });

        // HOJA 1: Resumen diario
        const porDia = new Map<string, { max: number; horaMax: string; count: number; picos: number }>();
        for (const dia of dias) porDia.set(dia, { max: -Infinity, horaMax: '', count: 0, picos: 0 });
        for (const r of rows) {
          const f = String(r.Fecha);
          const t = Number(r['Temperatura (°C)']);
          const agg = porDia.get(f) ?? { max: -Infinity, horaMax: '', count: 0, picos: 0 };
          agg.count++;
          if (Number.isFinite(t)) {
            if (t > agg.max) { agg.max = t; agg.horaMax = String(r.Hora); }
            if (t >= PASTEURIZATION_MIN) agg.picos++;
          }
          porDia.set(f, agg);
        }
        const resumenRows = dias.map((dia) => {
          const a = porDia.get(dia)!;
          const tuvo = a.picos > 0;
          return {
            Fecha: dia,
            'Lecturas': a.count,
            'Temp. Máxima (°C)': a.max === -Infinity ? '' : a.max,
            'Hora del Máximo': a.horaMax,
            'Picos ≥66°C': a.picos,
            'Pasteurización': tuvo ? `SÍ (${a.picos} picos)` : (a.count === 0 ? 'Sin datos' : 'NO'),
          };
        });
        const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
        wsResumen['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 22 }];
        const rgResumen = XLSX.utils.decode_range(wsResumen['!ref']!);
        for (let R = 1; R <= rgResumen.e.r; R++) {
          const picoCell = wsResumen[XLSX.utils.encode_cell({ r: R, c: 4 })];
          if (picoCell && typeof picoCell.v === 'number' && picoCell.v > 0) {
            for (let C = 0; C <= 5; C++) {
              const ref = XLSX.utils.encode_cell({ r: R, c: C });
              if (!wsResumen[ref]) wsResumen[ref] = { t: 's', v: '' };
              wsResumen[ref].s = {
                fill: { fgColor: { rgb: 'FFF4CCCC' } },
                font: { bold: true, color: { rgb: 'FF9C0006' } },
              };
            }
          }
        }
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Diario');

        // HOJA 2: Picos
        const picosRows = rows.filter((r: any) => typeof r['Temperatura (°C)'] === 'number' && r['Temperatura (°C)'] >= PASTEURIZATION_MIN);
        const totalPicos = picosRows.length;
        const wsPicos = XLSX.utils.json_to_sheet(picosRows.length ? picosRows : [{ Aviso: `Sin picos ≥${PASTEURIZATION_MIN}°C en el rango seleccionado` }]);
        wsPicos['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 22 }];
        XLSX.utils.book_append_sheet(wb, wsPicos, `Picos Pasteurización (${totalPicos})`);

        // HOJA 3: Log completo
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 22 }];
        const range = XLSX.utils.decode_range(ws['!ref']!);
        for (let R = 1; R <= range.e.r; R++) {
          const cell = ws[XLSX.utils.encode_cell({ r: R, c: 2 })];
          if (cell && typeof cell.v === 'number' && cell.v >= PASTEURIZATION_MIN) {
            for (let C = 0; C <= 5; C++) {
              const ref = XLSX.utils.encode_cell({ r: R, c: C });
              if (!ws[ref]) ws[ref] = { t: 's', v: '' };
              ws[ref].s = {
                fill: { fgColor: { rgb: 'FFF4CCCC' } },
                font: { bold: true, color: { rgb: 'FF9C0006' } },
              };
            }
          }
        }
        XLSX.utils.book_append_sheet(wb, ws, 'Temperatura Completa');
      } else {
        // Ventas
        const rows: Array<Record<string, unknown>> = [];
        for (const dia of dias) {
          const data = await fetchOrdenes(imei, dia);
          const ventas = Array.isArray(data?.ventas) ? data.ventas : [];
          for (const v of ventas) {
            const estado = String(v.estado || '').toLowerCase();
            if (estado === 'fallido' || estado === 'cancelado' || estado === 'failed' || estado === 'cancelled') continue;
            const { fecha, hora } = convertirVentaAEspana(v.fecha_hora_china || `${dia} 00:00:00`, imei);
            rows.push({
              Fecha: fecha || dia,
              Hora: hora,
              Producto: v.producto || '',
              'Precio (€)': Number(v.precio || 0),
              Unidades: v.cantidad_unidades || 1,
              'Método Pago': v.metodo_pago || '',
              'Nº Orden': v.numero_orden || v.id || '',
              Estado: v.estado || '',
              Toppings: Array.isArray(v.toppings) ? v.toppings.map((t: any) => `${t.nombre}${t.cantidad ? ` x${t.cantidad}` : ''}`).join(', ') : '',
            });
          }
        }

        if (rows.length === 0) {
          toast.error('No hay ventas en el rango seleccionado');
          setDownloading(false);
          return;
        }

        rows.sort((a, b) => {
          const ka = `${a.Fecha} ${a.Hora}`;
          const kb = `${b.Fecha} ${b.Hora}`;
          return ka < kb ? -1 : ka > kb ? 1 : 0;
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
      }

      XLSX.writeFile(wb, `${tipo}_${imei}_${desdeStr}_${hastaStr}.xlsx`);
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
