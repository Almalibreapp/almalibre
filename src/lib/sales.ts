import { convertChinaToSpainFull, getChinaDatesForSpainDate } from '@/lib/timezone';

type SaleLike = {
  id?: string | number;
  venta_api_id?: string | number;
  numero_orden?: string | number;
  fecha?: string;
  hora?: string;
  precio?: number | string;
  producto?: string;
  toppings?: unknown;
  [key: string]: unknown;
};

export type SalesTimezoneMode = 'spain' | 'china';

const normalizeDate = (value: unknown, fallback = '') => String(value || fallback).substring(0, 10);

const normalizeTime = (value: unknown) => {
  const raw = String(value || '00:00');
  return raw.length >= 5 ? raw.substring(0, 5) : '00:00';
};

const getHour = (value: unknown) => {
  const hour = Number.parseInt(normalizeTime(value).split(':')[0] || '0', 10);
  return Number.isFinite(hour) ? hour : 0;
};

export const detectSalesTimezoneMode = (sales: Array<{ hora?: string }>): SalesTimezoneMode => {
  const hours = sales.map((sale) => getHour(sale.hora));
  const earlyCount = hours.filter((hour) => hour >= 0 && hour <= 5).length;
  const eveningCount = hours.filter((hour) => hour >= 18).length;

  if (earlyCount >= 2 && eveningCount >= 2) {
    return 'china';
  }

  return 'spain';
};

export const normalizeSalesBatchToSpain = <T extends SaleLike>(sales: T[], fallbackDate: string) => {
  const timezoneMode = detectSalesTimezoneMode(sales);

  return sales.map((sale) => {
    const fecha = normalizeDate(sale.fecha, fallbackDate);
    const hora = normalizeTime(sale.hora);
    const spainDateTime = timezoneMode === 'china'
      ? convertChinaToSpainFull(hora, fecha)
      : { fecha, hora };

    const saleUid = String(
      sale.id
        ?? sale.venta_api_id
        ?? sale.numero_orden
        ?? `${fecha}|${hora}|${Number(sale.precio || 0)}|${String(sale.producto || '')}|${JSON.stringify(sale.toppings || [])}`
    );

    return {
      ...sale,
      fecha,
      hora,
      fechaSpain: spainDateTime.fecha,
      horaSpain: spainDateTime.hora,
      timezoneMode,
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

export const fetchSpanishDayOrders = async (
  imei: string,
  spainDate: string,
  fetcher: (imei: string, fecha?: string) => Promise<{ fecha?: string; ventas?: SaleLike[] }>
) => {
  const sourceDates = getChinaDatesForSpainDate(spainDate);
  const responses = await Promise.all(sourceDates.map((date) => fetcher(imei, date).catch(() => null)));

  const normalized = responses.flatMap((response, index) => {
    if (!response?.ventas || response.ventas.length === 0) return [];
    const fallbackDate = normalizeDate(response.fecha, sourceDates[index]);
    return normalizeSalesBatchToSpain(response.ventas, fallbackDate);
  });

  return dedupeSalesByUid(normalized).filter((sale) => sale.fechaSpain === spainDate);
};