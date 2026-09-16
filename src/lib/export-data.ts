import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export const PASTEURIZATION_MIN = 66;

export const addDaysISO = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

export const enumerateDates = (fromISO: string, toISO: string) => {
  const out: string[] = [];
  let cur = fromISO;
  while (cur <= toISO) {
    out.push(cur);
    cur = addDaysISO(cur, 1);
  }
  return out;
};

const decodeEntities = (text: string) => {
  if (!text) return '';
  if (typeof document === 'undefined') return text;
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
};

const PRODUCTO_BASE = 'AÇAÍ';

const normalizePago = (method?: string | null) => {
  const raw = decodeEntities(method || '').trim().toLowerCase();
  if (!raw) return 'tarjeta';
  if (raw.includes('bizum')) return 'bizum';
  if (raw.includes('apple')) return 'apple pay';
  if (raw.includes('google')) return 'google pay';
  return 'tarjeta';
};

const toppingsToText = (toppings: unknown) => {
  if (!Array.isArray(toppings)) return '';
  return toppings
    .map((t: any) => {
      const nombre = decodeEntities(String(t?.nombre ?? t ?? '')).trim();
      if (!nombre) return '';
      const cant = t?.cantidad && Number(t.cantidad) > 1 ? ` x${t.cantidad}` : '';
      return `${nombre}${cant}`;
    })
    .filter(Boolean)
    .join(', ');
};

export interface VentaRow {
  Fecha: string;
  Hora: string;
  Producto: string;
  'Precio (€)': number;
  Unidades: number;
  'Método Pago': string;
  'Nº Orden': string;
  Estado: string;
  Toppings: string;
}

/**
 * Lee las ventas directamente de la base de datos (ventas_historico),
 * ya en fecha y hora españolas. Paginado para superar el límite de 1000 filas.
 */
export const fetchVentasParaExportar = async (
  imei: string,
  desdeStr: string,
  hastaStr: string,
): Promise<VentaRow[]> => {
  const PAGE = 1000;
  const raw: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('ventas_historico')
      .select('id, imei, fecha, hora, producto, precio, cantidad_unidades, metodo_pago, numero_orden, venta_api_id, estado, toppings')
      .eq('imei', imei)
      .gte('fecha', desdeStr)
      .lte('fecha', hastaStr)
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    raw.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }

  const vistos = new Set<string>();
  const rows: VentaRow[] = [];
  for (const v of raw) {
    const estado = String(v.estado || '').toLowerCase();
    if (['fallido', 'cancelado', 'failed', 'cancelled'].includes(estado)) continue;
    const key = String(v.numero_orden || v.venta_api_id || v.id);
    if (vistos.has(key)) continue;
    vistos.add(key);
    rows.push({
      Fecha: String(v.fecha).slice(0, 10),
      Hora: String(v.hora || '').slice(0, 5),
      Producto: PRODUCTO_BASE,
      'Precio (€)': Number(v.precio || 0),
      Unidades: Number(v.cantidad_unidades || 1),
      'Método Pago': normalizePago(v.metodo_pago),
      'Nº Orden': String(v.numero_orden || v.venta_api_id || v.id || ''),
      Estado: String(v.estado || 'exitoso'),
      Toppings: toppingsToText(v.toppings),
    });
  }

  rows.sort((a, b) => `${a.Fecha} ${a.Hora}`.localeCompare(`${b.Fecha} ${b.Hora}`));
  return rows;
};

export interface TempRow {
  Fecha: string;
  Hora: string;
  'Temperatura (°C)': number | string;
  Estado: string;
  Sensor: string;
  Pasteurización: string;
}

/**
 * Lee las lecturas de temperatura día a día (consultas pequeñas para evitar
 * tiempos de espera sobre millones de registros) y devuelve filas en hora de Madrid.
 */
export const fetchTemperaturasParaExportar = async (
  imei: string,
  dias: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<TempRow[]> => {
  const rows: TempRow[] = [];
  const PAGE = 1000;

  for (let i = 0; i < dias.length; i++) {
    const dia = dias[i];
    const startISO = `${dia}T00:00:00.000Z`;
    const endISO = `${addDaysISO(dia, 1)}T00:00:00.000Z`;

    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('lecturas_temperatura')
        .select('temperatura, estado, sensor, created_at')
        .eq('imei', imei)
        .gte('created_at', startISO)
        .lt('created_at', endISO)
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      for (const d of data || []) {
        const dt = new Date(d.created_at as string);
        const temp = Number(d.temperatura);
        const esPico = Number.isFinite(temp) && temp >= PASTEURIZATION_MIN;
        rows.push({
          Fecha: dt.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }),
          Hora: dt.toLocaleTimeString('es-ES', {
            timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
          }),
          'Temperatura (°C)': Number.isFinite(temp) ? temp : '',
          Estado: (d.estado as string) || '',
          Sensor: (d.sensor as string) || '',
          Pasteurización: esPico ? `SÍ (≥${PASTEURIZATION_MIN}°C)` : '',
        });
      }
      if (!data || data.length < PAGE) break;
    }

    onProgress?.(i + 1, dias.length);
  }

  rows.sort((a, b) => `${a.Fecha} ${a.Hora}`.localeCompare(`${b.Fecha} ${b.Hora}`));
  return rows;
};

const highlightRows = (ws: XLSX.WorkSheet, col: number, cols: number, predicate: (v: any) => boolean) => {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = 1; R <= range.e.r; R++) {
    const cell = ws[XLSX.utils.encode_cell({ r: R, c: col })];
    if (cell && predicate(cell.v)) {
      for (let C = 0; C < cols; C++) {
        const ref = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[ref]) ws[ref] = { t: 's', v: '' };
        (ws[ref] as any).s = {
          fill: { fgColor: { rgb: 'FFF4CCCC' } },
          font: { bold: true, color: { rgb: 'FF9C0006' } },
        };
      }
    }
  }
};

export const buildTemperaturaWorkbook = (rows: TempRow[], dias: string[]) => {
  const wb = XLSX.utils.book_new();

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
    return {
      Fecha: dia,
      Lecturas: a.count,
      'Temp. Máxima (°C)': a.max === -Infinity ? '' : a.max,
      'Hora del Máximo': a.horaMax,
      'Picos ≥66°C': a.picos,
      'Pasteurización': a.picos > 0 ? `SÍ (${a.picos} picos)` : (a.count === 0 ? 'Sin datos' : 'NO'),
    };
  });
  const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
  wsResumen['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 22 }];
  wsResumen['!autofilter'] = { ref: wsResumen['!ref'] as string };
  wsResumen['!freeze'] = { xSplit: 0, ySplit: 1 } as any;
  highlightRows(wsResumen, 4, 6, (v) => typeof v === 'number' && v > 0);
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Diario');

  const picosRows = rows.filter((r) => typeof r['Temperatura (°C)'] === 'number' && (r['Temperatura (°C)'] as number) >= PASTEURIZATION_MIN);
  const wsPicos = XLSX.utils.json_to_sheet(
    picosRows.length ? picosRows : [{ Aviso: `Sin picos ≥${PASTEURIZATION_MIN}°C en el rango seleccionado` }],
  );
  wsPicos['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsPicos, `Picos Pasteurizacion (${picosRows.length})`);

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 22 }];
  ws['!autofilter'] = { ref: ws['!ref'] as string };
  highlightRows(ws, 2, 6, (v) => typeof v === 'number' && v >= PASTEURIZATION_MIN);
  XLSX.utils.book_append_sheet(wb, ws, 'Temperatura Completa');

  return wb;
};

export const buildVentasWorkbook = (rows: VentaRow[], dias: string[]) => {
  const wb = XLSX.utils.book_new();

  const porDia = new Map<string, { ventas: number; ingresos: number; unidades: number }>();
  for (const dia of dias) porDia.set(dia, { ventas: 0, ingresos: 0, unidades: 0 });
  for (const r of rows) {
    const agg = porDia.get(r.Fecha) ?? { ventas: 0, ingresos: 0, unidades: 0 };
    agg.ventas++;
    agg.ingresos += Number(r['Precio (€)'] || 0);
    agg.unidades += Number(r.Unidades || 1);
    porDia.set(r.Fecha, agg);
  }
  const resumenRows = dias.map((dia) => {
    const a = porDia.get(dia)!;
    return {
      Fecha: dia,
      Ventas: a.ventas,
      Unidades: a.unidades,
      'Ingresos (€)': Number(a.ingresos.toFixed(2)),
      'Ticket Medio (€)': a.ventas ? Number((a.ingresos / a.ventas).toFixed(2)) : 0,
    };
  });
  const totalIngresos = rows.reduce((s, r) => s + Number(r['Precio (€)'] || 0), 0);
  resumenRows.push({
    Fecha: 'TOTAL',
    Ventas: rows.length,
    Unidades: rows.reduce((s, r) => s + Number(r.Unidades || 1), 0),
    'Ingresos (€)': Number(totalIngresos.toFixed(2)),
    'Ticket Medio (€)': rows.length ? Number((totalIngresos / rows.length).toFixed(2)) : 0,
  });
  const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
  wsResumen['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 16 }];
  wsResumen['!autofilter'] = { ref: wsResumen['!ref'] as string };
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Diario');

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 11 }, { wch: 10 }, { wch: 14 }, { wch: 30 }, { wch: 12 }, { wch: 40 }];
  ws['!autofilter'] = { ref: ws['!ref'] as string };
  XLSX.utils.book_append_sheet(wb, ws, 'Ventas');

  return wb;
};
