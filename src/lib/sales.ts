import { Venta } from '@/types';

type SaleLike = {
  id?: string | number;
  venta_api_id?: string | number;
  numero_orden?: string | number;
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
};

const normalizeDate = (value: unknown, fallback = '') => String(value || fallback).substring(0, 10);

const normalizeTime = (value: unknown) => {
  const raw = String(value || '00:00');
  return raw.length >= 5 ? raw.substring(0, 5) : '00:00';
};

const toNumber = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
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
 * Backend ALREADY returns hora in Spain time and fecha as the Spain date.
 * NO timezone conversion is applied.
 */
export const mapSpainSaleToVenta = (sale: SaleLike): NormalizedVenta => {
  const fecha = normalizeDate(sale.fecha);
  const hora = normalizeTime(sale.hora);
  const saleUid = resolveSaleUid(sale, fecha, hora);

  return {
    id: String(sale.id ?? saleUid ?? sale.venta_api_id ?? sale.numero_orden ?? `${fecha}|${hora}|${toNumber(sale.precio)}|${String(sale.producto || '')}`),
    fecha,
    hora,
    fechaSpain: fecha,
    horaSpain: hora,
    _spainFecha: fecha,
    _spainHora: hora,
    saleUid,
    timezoneMode: 'spain',
    venta_api_id: sale.venta_api_id,
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
    const hourKey = `${normalizeTime(sale._spainHora ?? sale.hora).split(':')[0]}:00`;
    if (!acc[hourKey]) {
      acc[hourKey] = { ventas: 0, ingresos: 0 };
    }
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
 * Normalize a batch of sales — fields are used directly since
 * the backend already returns everything in Spain time.
 */
export const normalizeSalesBatchToSpain = <T extends SaleLike>(
  sales: T[],
  fallbackDate: string,
  _forcedTimezoneMode?: SalesTimezoneMode
) => {
  return sales.map((sale) => {
    const fecha = normalizeDate(sale.fecha, fallbackDate);
    const hora = normalizeTime(sale.hora);
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
 * The backend handles timezone conversion — we only need to fetch ONE date.
 * Past days come from PostgreSQL (<500ms), today comes from the live API.
 */
export const fetchSpanishDayOrders = async (
  imei: string,
  spainDate: string,
  fetcher: (imei: string, fecha?: string) => Promise<{ fecha?: string; ventas?: SaleLike[] }>
) => {
  const response = await fetcher(imei, spainDate).catch(() => null);
  const sales = response?.ventas ?? [];
  const normalized = normalizeSalesBatchToSpain(sales, spainDate);
  return dedupeSalesByUid(normalized);
};

export const fetchSpainDayVentas = async (
  imei: string,
  spainDate: string,
  fetcher: (imei: string, fecha?: string) => Promise<{ fecha?: string; ventas?: SaleLike[] }>
) => {
  const sales = await fetchSpanishDayOrders(imei, spainDate, fetcher);
  return sales.map(mapSpainSaleToVenta);
};
