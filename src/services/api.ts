import { API_CONFIG } from '@/config/api';

const normalizeTemperatureDateParam = (value: string | undefined, fallback: string) => {
  const raw = String(value || '').trim();
  const match = raw.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] || fallback;
};

// FUENTE ÚNICA DE VENTAS: la base de datos (ventas_historico).
// La API del fabricante en tiempo real devolvía datos incoherentes
// (día chino, métodos de pago inventados, duplicados), así que ya NO se usa
// para mostrar ventas en la app.
const ventasInflight = new Map<string, Promise<any>>();

// El efectivo está bloqueado en todas las máquinas: cualquier venta que llegue
// marcada como efectivo/cash es un valor por defecto erróneo del proveedor.
const normalizeMetodoPago = (value: unknown) => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return 'tarjeta';
  if (raw.includes('cupon') || raw.includes('cupón') || raw.includes('coupon')) return 'cupon';
  if (raw.includes('bizum')) return 'bizum';
  if (raw.includes('apple')) return 'apple pay';
  if (raw.includes('google')) return 'google pay';
  // efectivo/cash/metálico => no existe operativamente
  return 'tarjeta';
};





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


const decodeEntities = (text: string) =>
  String(text || '')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú');

/**
 * Ventas de un día (fecha española) leídas SIEMPRE de la base de datos.
 */
const performVentasFetch = async (imei: string, dateStr: string, tag: 'detalle' | 'ordenes') => {
  const key = `${tag}|${imei}|${dateStr}`;

  const inflight = ventasInflight.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data, error } = await supabase
      .from('ventas_historico')
      .select('id, venta_api_id, fecha, hora, producto, precio, cantidad_unidades, metodo_pago, numero_orden, estado, toppings')
      .eq('imei', imei)
      .eq('fecha', dateStr)
      .order('hora', { ascending: true });

    if (error) throw error;

    const mappedVentas = (data || []).map((v: any) => ({
      id: String(v.id),
      venta_api_id: v.venta_api_id,
      fecha: v.fecha,
      hora: String(v.hora || '00:00').substring(0, 5),
      producto: decodeEntities(v.producto || ''),
      precio: Number(v.precio || 0),
      cantidad_unidades: Number(v.cantidad_unidades || 1),
      metodo_pago: normalizeMetodoPago(v.metodo_pago),
      numero_orden: v.numero_orden || undefined,
      estado: v.estado || 'exitoso',
      toppings: Array.isArray(v.toppings) ? v.toppings : [],
    }));

    // Defensa adicional: una venta física se identifica por su número de orden.
    // Así una fila heredada con otro venta_api_id nunca se muestra dos veces.
    const ventas = Array.from(new Map(
      mappedVentas.map((venta: any) => [
        String(venta.numero_orden || venta.venta_api_id || venta.id),
        venta,
      ])
    ).values());

    return {
      mac_addr: imei,
      fecha: dateStr,
      total_ventas: ventas.length,
      ventas,
      fuente: 'supabase',
    };
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
    // IMPORTANTE: el stock del SISTEMA es autónomo. Nunca se replica el stock
    // que reporta la máquina física (s.unidades_actuales / s.stock_actual).
    const stockActual = config?.unidades_actuales ?? 0;
    const capacidad = config?.capacidad_maxima ?? 100;
    return {
      posicion: pos,
      nombre: s.nombre || s.name || '',
      stock_actual: stockActual,
      capacidad_maxima: capacidad,
      porcentaje: capacidad > 0 ? Math.round((stockActual / capacidad) * 100) : 0,
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
