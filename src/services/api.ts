import { API_CONFIG } from '@/config/api';

const normalizeTemperatureDateParam = (value: string | undefined, fallback: string) => {
  const raw = String(value || '').trim();
  const match = raw.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] || fallback;
};

// In-flight dedupe + reintentos para el endpoint "ventas" (upstream inestable).
// IMPORTANTE: nunca devolvemos un resultado vacío ante un fallo, porque eso
// hacía que faltaran ventas en el panel. Reintentamos y, si aún falla,
// devolvemos la última respuesta correcta cacheada o lanzamos el error para
// que React Query reintente y conserve los datos anteriores.
const ventasInflight = new Map<string, Promise<any>>();
const ventasSuccessCache = new Map<string, { data: any; at: number }>();
const VENTAS_CACHE_TTL_MS = 10 * 60 * 1000;
const VENTAS_MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));



// Información general de la máquina
export const fetchMiMaquina = async (imei: string) => {
  const response = await fetch(`${API_CONFIG.endpoints.estado}?imei=${imei}`, { headers: API_CONFIG.headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${response.status}: No se pudo obtener la información de la máquina`);
  }
  return response.json();
};

// Resumen de ventas - fetch today's sales and compute summary
export const fetchVentasResumen = async (imei: string) => {
  const { fetchSpanishDayOrders } = await import('@/lib/sales');
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  try {
    // Usa fetchSpanishDayOrders para que la máquina 865622072039477 (China UTC+8)
    // incluya las ventas de mañana-China que en España son de hoy.
    const exitosas = (await fetchSpanishDayOrders(imei, today, fetchOrdenes)).filter((v: any) => {
      const estado = (v.estado || '').toLowerCase();
      return estado !== 'fallido' && estado !== 'cancelado' && estado !== 'failed' && estado !== 'cancelled';
    });
    return {
      mac_addr: imei,
      ventas_hoy: {
        cantidad: exitosas.length,
        total_euros: exitosas.reduce((s: number, v: any) => s + Number(v.precio || 0), 0),
      },
      ventas_ayer: { cantidad: 0, total_euros: 0 },
      ventas_mes: { cantidad: 0, total_euros: 0 },
    };
  } catch (err) {
    // No devolvemos ceros: propagamos para que la query reintente y no se
    // muestren ventas incompletas.
    console.warn(`[fetchVentasResumen] Error for ${imei}:`, err);
    throw err;
  }
};


const performVentasFetch = async (imei: string, dateStr: string, tag: 'detalle' | 'ordenes') => {
  const key = `${tag}|${imei}|${dateStr}`;

  // Dedupe concurrent identical requests.
  const inflight = ventasInflight.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= VENTAS_MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(
          `${API_CONFIG.endpoints.ventas}?imei=${imei}&fecha=${dateStr}`,
          { headers: API_CONFIG.headers }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const text = await response.text();
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          throw new Error('Respuesta HTML del upstream');
        }

        const data = JSON.parse(text);
        const ventas = (data.ventas || []).map((v: any, index: number) => ({
          ...v,
          // El uid debe ser único aunque falten id/numero_orden: incluimos índice
          // para no perder ventas idénticas (misma hora y precio) al deduplicar.
          id: v.id || v.numero_orden || `${imei}-${dateStr}-${v.fecha_hora_china || ''}-${v.precio}-${index}`,
          fecha_hora_china: v.fecha_hora_china || '',
          fecha: dateStr,
          producto: v.producto || '',
          precio: Number(v.precio || 0),
          cantidad_unidades: v.cantidad_unidades || v.cantidad || 1,
          metodo_pago: v.metodo_pago || '',
          estado: v.estado || 'exitoso',
          toppings: v.toppings || [],
        }));

        const result = {
          mac_addr: data.imei || imei,
          fecha: data.fecha || dateStr,
          total_ventas: data.total || ventas.length,
          ventas,
          fuente: data.fuente,
        };

        ventasSuccessCache.set(key, { data: result, at: Date.now() });
        return result;
      } catch (err) {
        lastError = err;
        console.warn(`[fetchVentas/${tag}] intento ${attempt} falló para ${imei} ${dateStr}:`, err);
        if (attempt < VENTAS_MAX_ATTEMPTS) await sleep(400 * attempt);
      }
    }

    // Fallback: última respuesta correcta reciente (mejor que perder ventas).
    const cached = ventasSuccessCache.get(key);
    if (cached && Date.now() - cached.at < VENTAS_CACHE_TTL_MS) {
      console.warn(`[fetchVentas/${tag}] usando caché para ${imei} ${dateStr}`);
      return cached.data;
    }

    // Sin datos fiables: propagamos el error para que la query reintente
    // en lugar de mostrar un día con ventas incompletas.
    throw lastError instanceof Error
      ? lastError
      : new Error(`No se pudieron obtener las ventas de ${imei} (${dateStr})`);
  })();

  promise.catch(() => {}).finally(() => ventasInflight.delete(key));
  ventasInflight.set(key, promise);
  return promise;
};


/**
 * Fetch sales for a specific date.
 */
export const fetchVentasDetalle = async (imei: string, fecha?: string) => {
  const dateStr = fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  return performVentasFetch(imei, dateStr, 'detalle');
};

/**
 * Fetch orders for a specific date.
 */
export const fetchOrdenes = async (imei: string, fecha?: string) => {
  const dateStr = fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  return performVentasFetch(imei, dateStr, 'ordenes');
};


// Stock de toppings — merges manufacturer API with stock_config capacities
export const fetchToppings = async (imei: string) => {
  const { supabase } = await import('@/integrations/supabase/client');

  // Fetch manufacturer API and stock_config in parallel
  const [response, { data: stockConfig }] = await Promise.all([
    fetch(`${API_CONFIG.endpoints.stock}?imei=${imei}`, { headers: API_CONFIG.headers }),
    supabase.from('stock_config').select('topping_position, capacidad_maxima, unidades_actuales').eq('machine_imei', imei),
  ]);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${response.status}: No se pudo obtener el stock de toppings`);
  }

  const data = await response.json();
  const stock = data.stock || [];

  // Build a map of configured capacities from stock_config
  const configMap = new Map<string, { capacidad_maxima: number; unidades_actuales: number }>();
  (stockConfig || []).forEach((c: any) => {
    configMap.set(String(c.topping_position), { capacidad_maxima: c.capacidad_maxima, unidades_actuales: c.unidades_actuales });
  });

  const toppings = stock.map((s: any) => {
    const pos = String(s.position || s.posicion);
    const config = configMap.get(pos);
    return {
      posicion: pos,
      nombre: s.nombre || s.name || '',
      stock_actual: config?.unidades_actuales ?? s.unidades_actuales ?? s.actual ?? s.stock_actual ?? 0,
      capacidad_maxima: config?.capacidad_maxima ?? s.capacidad_maxima ?? s.maximo ?? 100,
      porcentaje: s.porcentaje ?? 0,
      estado: s.estado || 'ok',
    };
  });
  return {
    mac_addr: imei,
    toppings,
    total_toppings: toppings.length,
  };
};

/**
 * Fetch temperature data.
 * Backend returns timestamps already in Spain time.
 */
export const fetchTemperatura = async (imei: string, start?: string, end?: string) => {
  const todaySpain = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const endDate = normalizeTemperatureDateParam(end, todaySpain);
  const startDate = normalizeTemperatureDateParam(start, endDate);

  try {
    const response = await fetch(
      `${API_CONFIG.endpoints.temperatura}?imei=${imei}&start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`,
      { headers: API_CONFIG.headers }
    );
    if (!response.ok) {
      console.warn(`[temperatura] HTTP ${response.status} for ${imei}`);
      return {
        mac_addr: imei,
        temperatura: null,
        unidad: 'C',
        estado: 'sin_datos',
        timestamp: new Date().toISOString(),
      };
    }

    const data = await response.json();
    console.log('RESPUESTA TEMPERATURA:', data);

    const datos = Array.isArray(data.datos) ? data.datos : [];
    const latest = datos.length > 0 ? datos[datos.length - 1] : null;
    const temperaturaActual = latest ? Number(latest.temperatura) : null;

    console.log('TEMPERATURA ACTUAL:', temperaturaActual);

    return {
      mac_addr: imei,
      temperatura: Number.isFinite(temperaturaActual) ? temperaturaActual : null,
      unidad: 'C',
      estado: latest?.estado || 'sin_datos',
      timestamp: latest?.timestamp || '',
      datos,
      fuente: data.fuente,
    };
  } catch (err) {
    console.warn(`[temperatura] Error fetching for ${imei}:`, err);
    return {
      mac_addr: imei,
      temperatura: null,
      unidad: 'C',
      estado: 'sin_datos',
      timestamp: '',
    };
  }
};

// Estadísticas de toppings - uses stock endpoint
export const fetchEstadisticasToppings = async (imei: string) => {
  return fetchToppings(imei);
};

// Estado de la máquina
export const fetchEstadoMaquina = async (imei: string) => {
  const response = await fetch(`${API_CONFIG.endpoints.estado}?imei=${imei}`, { headers: API_CONFIG.headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${response.status}: No se pudo obtener el estado`);
  }
  return response.json();
};

// Validar IMEI (15 dígitos numéricos)
export const validarIMEI = (imei: string): boolean => {
  const soloNumeros = imei.replace(/\D/g, '');
  return soloNumeros.length === 15;
};
