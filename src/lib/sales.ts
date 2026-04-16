import { Venta } from '@/types';
import { convertirHoraSegunMaquina, extraerFechaVenta } from '@/lib/timezone-utils';

type SaleLike = {
  id?: string | number;
  venta_api_id?: string | number;
  numero_orden?: string | number;
  fecha_hora_china?: string;
  fecha?: string;
  hora?: string;
  precio?: number | string;
  producto?: string;
  estado?: string;
  toppings?: unknown;
  cantidad_unidades?: number | string;
  cantidad?: number | string;
  metodo_pago?: string;
  payment_method?: string;
  pay_type?: string;
  [key: string]: unknown;
};

export type SalesTimezoneMode = 'spain';

export type NormalizedVenta = Venta & {
  fecha: string;
  fechaSpain: string;
  horaSpain: string;
  _spainFecha: string;
  _spainHora: string;
  saleUid: string;
  timezoneMode: SalesTimezoneMode;
  venta_api_id?: string | number;
  fecha_hora_china?: string;
};

const toNumber = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Extract Spain date and time from a sale using fecha_hora_china.
 */
const extractSpainDateTime = (sale: SaleLike, imei: string = ''): { fecha: string; hora: string } => {
  const fechaHoraChina = sale.fecha_hora_china;
  if (fechaHoraChina) {
    return {
      fecha: extraerFechaVenta(fechaHoraChina),
      hora: convertirHoraSegunMaquina(fechaHoraChina, imei),
    };
  }
  // Fallback for legacy data without fecha_hora_china
  const fecha = String(sale.fecha || '').substring(0, 10);
  const hora = String(sale.hora || '00:00').substring(0, 5);
  return { fecha, hora };
};

const resolveSaleUid = (sale: SaleLike, fecha: string, hora: string) => String(
  sale.id
    ?? sale.venta_api_id
    ?? sale.numero_orden
    ?? `${fecha}|${hora}|${toNumber(sale.precio)}|${String(sale.producto || '')}|${JSON.stringify(sale.toppings || [])}`
);

const resolvePaymentMethod = (sale: SaleLike) => {
  const raw = sale.metodo_pago ?? sale.payment_method ?? sale.pay_type;
  if (raw === undefined || raw === null) return undefined;
  const normalized = String(raw).trim();
  return normalized || undefined;
};

/**
 * Map a raw sale from the API to a normalized venta.
 * Uses fecha_hora_china as the source of truth for time.
 */
export const mapSpainSaleToVenta = (sale: SaleLike, imei: string = ''): NormalizedVenta => {
  const spain = extractSpainDateTime(sale, imei);
  const fecha = spain.fecha;
  const hora = spain.hora;
  const saleUid = resolveSaleUid(sale, fecha, hora);

  return {
    id: String(sale.id ?? saleUid),
    fecha,
    hora,
    fechaSpain: fecha,
    horaSpain: hora,
    _spainFecha: fecha,
    _spainHora: hora,
    saleUid,
    timezoneMode: 'spain',
    venta_api_id: sale.venta_api_id,
    fecha_hora_china: sale.fecha_hora_china,
    precio: toNumber(sale.precio),
    producto: String(sale.producto || ''),
    estado: String(sale.estado || 'exitoso'),
    toppings: Array.isArray(sale.toppings) ? sale.toppings : [],
    cantidad_unidades: Math.max(1, toNumber(sale.cantidad_unidades ?? sale.cantidad ?? 1)),
    metodo_pago: resolvePaymentMethod(sale),
    numero_orden: sale.numero_orden ? String(sale.numero_orden) : undefined,
  };
};

export const isSuccessfulSale = (sale: { estado?: unknown }) => {
  const status = String(sale.estado || '').toLowerCase();
  return status !== 'fallido' && status !== 'cancelado' && status !== 'failed' && status !== 'cancelled';
};

export const summarizeSales = <T extends { precio?: unknown; cantidad_unidades?: unknown; estado?: unknown }>(sales: T[]) => {
  const successful = sales.filter(isSuccessfulSale);
  return {
    cantidad: successful.length,
    total_euros: successful.reduce((sum, sale) => sum + toNumber(sale.precio), 0),
    total_unidades: successful.reduce((sum, sale) => sum + Math.max(1, toNumber(sale.cantidad_unidades ?? 1)), 0),
  };
};

export const buildHourlySalesData = <T extends { _spainHora?: unknown; hora?: unknown; precio?: unknown }>(sales: T[]) => {
  const grouped = sales.reduce((acc, sale) => {
    const rawHora = String(sale._spainHora ?? sale.hora ?? '00:00');
    const hourKey = `${rawHora.split(':')[0]}:00`;
    if (!acc[hourKey]) acc[hourKey] = { ventas: 0, ingresos: 0 };
    acc[hourKey].ventas += 1;
    acc[hourKey].ingresos += toNumber(sale.precio);
    return acc;
  }, {} as Record<string, { ventas: number; ingresos: number }>);

  return Object.entries(grouped)
    .map(([hora, data]) => ({ hora, ventas: data.ventas, ingresos: data.ingresos }))
    .sort((a, b) => a.hora.localeCompare(b.hora));
};

export const getPeakSalesHour = <T extends { _spainHora?: unknown; hora?: unknown; precio?: unknown }>(sales: T[]) => {
  return buildHourlySalesData(sales).reduce<{ hora: string; ventas: number; ingresos: number } | null>((peak, current) => {
    if (!peak || current.ventas > peak.ventas) return current;
    return peak;
  }, null);
};

export const getCurrentSpainDate = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });

export const shiftSpainDate = (date: string, days: number) => {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().substring(0, 10);
};

export const getMonthDatesUntil = (spainDate: string) => {
  const [year, month, day] = spainDate.split('-').map(Number);
  return Array.from({ length: day || 0 }, (_, index) => {
    return `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
  });
};

/**
 * Normalize a batch of sales. Uses fecha_hora_china as time source.
 */
export const normalizeSalesBatchToSpain = <T extends SaleLike>(
  sales: T[],
  fallbackDate: string,
  _forcedTimezoneMode?: SalesTimezoneMode,
  imei: string = ''
) => {
  return sales.map((sale) => {
    const spain = extractSpainDateTime(sale, imei);
    const fecha = spain.fecha || fallbackDate;
    const hora = spain.hora;
    const saleUid = String(
      sale.id ?? sale.venta_api_id ?? sale.numero_orden
        ?? `${fecha}|${hora}|${Number(sale.precio || 0)}|${String(sale.producto || '')}|${JSON.stringify(sale.toppings || [])}`
    );
    return {
      ...sale,
      fecha,
      hora,
      fechaSpain: fecha,
      horaSpain: hora,
      _spainFecha: fecha,
      _spainHora: hora,
      timezoneMode: 'spain' as SalesTimezoneMode,
      saleUid,
    };
  });
};

export const dedupeSalesByUid = <T extends { saleUid?: string; id?: string | number }>(sales: T[]) => {
  const seen = new Set<string>();
  return sales.filter((sale) => {
    const key = String(sale.saleUid || sale.id || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Fetch sales for a given Spain date.
 */
export const fetchSpanishDayOrders = async (
  imei: string,
  spainDate: string,
  fetcher: (imei: string, fecha?: string) => Promise<{ fecha?: string; ventas?: SaleLike[] }>
) => {
  const prevDate = shiftSpainDate(spainDate, -1);
  const [response1, response2] = await Promise.all([
    fetcher(imei, prevDate).catch(() => null),
    fetcher(imei, spainDate).catch(() => null),
  ]);
  const sales1 = response1?.ventas ?? [];
  const sales2 = response2?.ventas ?? [];
  const allSales = [...sales1, ...sales2];
  const normalized = normalizeSalesBatchToSpain(allSales, spainDate);
  return dedupeSalesByUid(normalized).filter((sale) => sale.fechaSpain === spainDate);
};

export const fetchSpainDayVentas = async (
  imei: string,
  spainDate: string,
  fetcher: (imei: string, fecha?: string) => Promise<{ fecha?: string; ventas?: SaleLike[] }>
) => {
  const sales = await fetchSpanishDayOrders(imei, spainDate, fetcher);
  return sales.map((sale) => mapSpainSaleToVenta(sale, imei));
};
