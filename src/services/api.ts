import { API_HEADERS, API_ENDPOINTS } from '@/lib/api-config';

// Información general de la máquina (uses ventas endpoint with no date)
export const fetchMiMaquina = async (imei: string) => {
  const response = await fetch(`${API_ENDPOINTS.estado}?imei=${imei}`, { headers: API_HEADERS });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${response.status}: No se pudo obtener la información de la máquina`);
  }
  return response.json();
};

// Resumen de ventas - fetch today's sales and compute summary
export const fetchVentasResumen = async (imei: string) => {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const response = await fetch(`${API_ENDPOINTS.ventas}?imei=${imei}&fecha=${today}`, { headers: API_HEADERS });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${response.status}: No se pudo obtener el resumen de ventas`);
  }
  const data = await response.json();
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
};

// Detalle de ventas
export const fetchVentasDetalle = async (imei: string, fecha?: string) => {
  const dateStr = fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const response = await fetch(`${API_ENDPOINTS.ventas}?imei=${imei}&fecha=${dateStr}`, { headers: API_HEADERS });
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
      // hora already comes in Spain timezone from the backend
      hora: v.hora_spain || v.hora || '00:00',
      fecha: v.fecha_spain || v.fecha || dateStr,
      producto: v.producto || '',
      precio: Number(v.precio || 0),
      cantidad_unidades: v.cantidad_unidades || v.cantidad || 1,
      metodo_pago: v.metodo_pago || 'efectivo',
      estado: v.estado || 'exitoso',
      toppings: v.toppings || [],
    })),
  };
};

// Ordenes del fabricante - now uses Supabase Edge Function
// Hours already come in Spain timezone
export const fetchOrdenes = async (imei: string, fecha?: string) => {
  const dateStr = fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const response = await fetch(`${API_ENDPOINTS.ventas}?imei=${imei}&fecha=${dateStr}`, { headers: API_HEADERS });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${response.status}: No se pudo obtener las órdenes`);
  }
  const data = await response.json();
  const ventas = (data.ventas || []).map((v: any) => ({
    ...v,
    id: v.id || v.numero_orden || `${v.hora_spain || v.hora}-${v.precio}`,
    hora: v.hora_spain || v.hora || '00:00',
    fecha: v.fecha_spain || v.fecha || dateStr,
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
};

// Stock de toppings
export const fetchToppings = async (imei: string) => {
  const response = await fetch(`${API_ENDPOINTS.stock}?imei=${imei}`, { headers: API_HEADERS });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${response.status}: No se pudo obtener el stock de toppings`);
  }
  const data = await response.json();
  const stock = data.stock || [];
  const toppings = stock.map((s: any) => ({
    posicion: s.position || s.posicion,
    nombre: s.nombre || s.name || '',
    stock_actual: s.actual ?? s.stock_actual ?? 0,
    capacidad_maxima: s.maximo ?? s.capacidad_maxima ?? 100,
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
export const fetchTemperatura = async (imei: string) => {
  const response = await fetch(`${API_ENDPOINTS.temperatura}?imei=${imei}`, { headers: API_HEADERS });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${response.status}: No se pudo obtener la temperatura`);
  }
  const data = await response.json();
  const datos = data.datos || [];
  const latest = datos.length > 0 ? datos[datos.length - 1] : null;
  return {
    mac_addr: imei,
    temperatura: latest?.temperatura ?? data.temperatura ?? null,
    unidad: latest?.unidad || data.unidad || 'C',
    estado: latest?.estado || data.estado || 'normal',
    timestamp: latest?.timestamp || data.timestamp || new Date().toISOString(),
  };
};

// Estadísticas de toppings - uses stock endpoint
export const fetchEstadisticasToppings = async (imei: string) => {
  return fetchToppings(imei);
};

// Estado de la máquina
export const fetchEstadoMaquina = async (imei: string) => {
  const response = await fetch(`${API_ENDPOINTS.estado}?imei=${imei}`, { headers: API_HEADERS });
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
