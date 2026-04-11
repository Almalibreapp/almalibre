import { API_CONFIG } from '@/config/api';

const normalizeTemperatureDateParam = (value: string | undefined, fallback: string) => {
  const raw = String(value || '').trim();
  const match = raw.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] || fallback;
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
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  try {
    const response = await fetch(`${API_CONFIG.endpoints.ventas}?imei=${imei}&fecha=${today}`, { headers: API_CONFIG.headers });
    if (!response.ok) {
      console.warn(`[fetchVentasResumen] HTTP ${response.status} for ${imei}`);
      return { mac_addr: imei, ventas_hoy: { cantidad: 0, total_euros: 0 }, ventas_ayer: { cantidad: 0, total_euros: 0 }, ventas_mes: { cantidad: 0, total_euros: 0 } };
    }
    const text = await response.text();
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      console.warn(`[fetchVentasResumen] Server returned HTML for ${imei}`);
      return { mac_addr: imei, ventas_hoy: { cantidad: 0, total_euros: 0 }, ventas_ayer: { cantidad: 0, total_euros: 0 }, ventas_mes: { cantidad: 0, total_euros: 0 } };
    }
    const data = JSON.parse(text);
    const ventas = data.ventas || [];
    const exitosas = ventas.filter((v: any) => {
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
    console.warn(`[fetchVentasResumen] Error for ${imei}:`, err);
    return { mac_addr: imei, ventas_hoy: { cantidad: 0, total_euros: 0 }, ventas_ayer: { cantidad: 0, total_euros: 0 }, ventas_mes: { cantidad: 0, total_euros: 0 } };
  }
};

/**
 * Fetch sales for a specific date.
 * Backend now sends fecha_hora_china field for each sale.
 */
export const fetchVentasDetalle = async (imei: string, fecha?: string) => {
  const dateStr = fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  try {
    const response = await fetch(`${API_CONFIG.endpoints.ventas}?imei=${imei}&fecha=${dateStr}`, { headers: API_CONFIG.headers });
    if (!response.ok) {
      console.warn(`[fetchVentasDetalle] HTTP ${response.status} for ${imei} ${dateStr}`);
      return { mac_addr: imei, fecha: dateStr, total_ventas: 0, ventas: [] };
    }
    const text = await response.text();
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      console.warn(`[fetchVentasDetalle] Server returned HTML for ${imei} ${dateStr}`);
      return { mac_addr: imei, fecha: dateStr, total_ventas: 0, ventas: [] };
    }
    const data = JSON.parse(text);
    const ventas = (data.ventas || []).map((v: any) => ({
      ...v,
      fecha_hora_china: v.fecha_hora_china || '',
      fecha: dateStr,
      producto: v.producto || '',
      precio: Number(v.precio || 0),
      cantidad_unidades: v.cantidad_unidades || v.cantidad || 1,
      metodo_pago: v.metodo_pago || '',
      estado: v.estado || 'exitoso',
      toppings: v.toppings || [],
    }));
    return {
      mac_addr: data.imei || imei,
      fecha: data.fecha || dateStr,
      total_ventas: data.total || ventas.length,
      ventas,
      fuente: data.fuente,
    };
  } catch (err) {
    console.warn(`[fetchVentasDetalle] Error for ${imei} ${dateStr}:`, err);
    return { mac_addr: imei, fecha: dateStr, total_ventas: 0, ventas: [] };
  }
};

/**
 * Fetch orders for a specific date.
 * Backend now sends fecha_hora_china field.
 */
export const fetchOrdenes = async (imei: string, fecha?: string) => {
  const dateStr = fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  try {
    const response = await fetch(`${API_CONFIG.endpoints.ventas}?imei=${imei}&fecha=${dateStr}`, { headers: API_CONFIG.headers });
    if (!response.ok) {
      console.warn(`[fetchOrdenes] HTTP ${response.status} for ${imei} ${dateStr}`);
      return { mac_addr: imei, fecha: dateStr, total_ventas: 0, ventas: [] };
    }
    const text = await response.text();
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      console.warn(`[fetchOrdenes] Server returned HTML for ${imei} ${dateStr}`);
      return { mac_addr: imei, fecha: dateStr, total_ventas: 0, ventas: [] };
    }
    const data = JSON.parse(text);
    const ventas = (data.ventas || []).map((v: any) => ({
      ...v,
      id: v.id || v.numero_orden || `${v.fecha_hora_china}-${v.precio}`,
      fecha_hora_china: v.fecha_hora_china || '',
      fecha: dateStr,
      producto: v.producto || '',
      precio: Number(v.precio || 0),
      cantidad_unidades: v.cantidad_unidades || v.cantidad || 1,
      metodo_pago: v.metodo_pago || '',
      estado: v.estado || 'exitoso',
      toppings: v.toppings || [],
    }));
    return {
      mac_addr: data.imei || imei,
      fecha: data.fecha || dateStr,
      total_ventas: data.total || ventas.length,
      ventas,
      fuente: data.fuente,
    };
  } catch (err) {
    console.warn(`[fetchOrdenes] Error for ${imei} ${dateStr}:`, err);
    return { mac_addr: imei, fecha: dateStr, total_ventas: 0, ventas: [] };
  }
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
