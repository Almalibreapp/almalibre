import { API_CONFIG } from '@/config/api';

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

// Detalle de ventas
export const fetchVentasDetalle = async (imei: string, fecha?: string) => {
  const dateStr = fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const response = await fetch(`${API_CONFIG.endpoints.ventas}?imei=${imei}&fecha=${dateStr}`, { headers: API_CONFIG.headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${response.status}: No se pudo obtener el detalle de ventas`);
  }
  const data = await response.json();
  return {
    mac_addr: data.imei || imei,
    fecha: data.fecha || dateStr,
    total_ventas: data.total || (data.ventas || []).length,
    ventas: (data.ventas || []).map((v: any) => ({
      ...v,
      hora: v.hora || '00:00',
      fecha: v.fecha || dateStr,
      producto: v.producto || '',
      precio: Number(v.precio || 0),
      cantidad_unidades: v.cantidad_unidades || v.cantidad || 1,
      metodo_pago: v.metodo_pago || 'efectivo',
      estado: v.estado || 'exitoso',
      toppings: v.toppings || [],
    })),
  };
};

// Ordenes del fabricante
export const fetchOrdenes = async (imei: string, fecha?: string) => {
  const dateStr = fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  try {
    const response = await fetch(`${API_CONFIG.endpoints.ventas}?imei=${imei}&fecha=${dateStr}`, { headers: API_CONFIG.headers });
    if (!response.ok) {
      console.warn(`[fetchOrdenes] HTTP ${response.status} for ${imei} ${dateStr}`);
      return {
        mac_addr: imei,
        fecha: dateStr,
        total_ventas: 0,
        ventas: [],
      };
    }
    const text = await response.text();
    // Guard against HTML error pages
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      console.warn(`[fetchOrdenes] Server returned HTML for ${imei} ${dateStr}`);
      return { mac_addr: imei, fecha: dateStr, total_ventas: 0, ventas: [] };
    }
    const data = JSON.parse(text);
    const ventas = (data.ventas || []).map((v: any) => ({
      ...v,
      id: v.id || v.numero_orden || `${v.hora}-${v.precio}`,
      hora: v.hora || '00:00',
      fecha: v.fecha || dateStr,
      producto: v.producto || '',
      precio: Number(v.precio || 0),
      cantidad_unidades: v.cantidad_unidades || v.cantidad || 1,
      metodo_pago: v.metodo_pago || 'efectivo',
      estado: v.estado || 'exitoso',
      toppings: v.toppings || [],
    }));
    return {
      mac_addr: data.imei || imei,
      fecha: data.fecha || dateStr,
      total_ventas: data.total || ventas.length,
      ventas,
    };
  } catch (err) {
    console.warn(`[fetchOrdenes] Error for ${imei} ${dateStr}:`, err);
    return { mac_addr: imei, fecha: dateStr, total_ventas: 0, ventas: [] };
  }
};

// Stock de toppings
export const fetchToppings = async (imei: string) => {
  const response = await fetch(`${API_CONFIG.endpoints.stock}?imei=${imei}`, { headers: API_CONFIG.headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${response.status}: No se pudo obtener el stock de toppings`);
  }
  const data = await response.json();
  const stock = data.stock || [];
  const toppings = stock.map((s: any) => ({
    posicion: s.position || s.posicion,
    nombre: s.nombre || s.name || '',
    stock_actual: s.unidades_actuales ?? s.actual ?? s.stock_actual ?? 0,
    capacidad_maxima: s.capacidad_maxima ?? s.maximo ?? 100,
    porcentaje: s.porcentaje ?? 0,
    estado: s.estado || 'ok',
  }));
  return {
    mac_addr: imei,
    toppings,
    total_toppings: toppings.length,
  };
};

// Temperatura
export const fetchTemperatura = async (imei: string, start?: string, end?: string) => {
  const now = new Date();
  const endDate = end || now.toISOString();
  const startDate = start || new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
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
    const datos = Array.isArray(data.datos) ? data.datos : [];
    const latest = datos.length > 0 ? datos[datos.length - 1] : null;
    return {
      mac_addr: imei,
      temperatura: latest?.temperatura ?? data.temperatura ?? null,
      unidad: latest?.unidad || data.unidad || 'C',
      estado: latest?.estado || data.estado || 'normal',
      timestamp: latest?.timestamp || data.timestamp || new Date().toISOString(),
    };
  } catch (err) {
    console.warn(`[temperatura] Error fetching for ${imei}:`, err);
    return {
      mac_addr: imei,
      temperatura: null,
      unidad: 'C',
      estado: 'sin_datos',
      timestamp: new Date().toISOString(),
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
