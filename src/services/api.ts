const API_BASE_URL = 'https://nonstopmachine.com/wp-json/helados/v1';
const API_TOKEN = 'b7Jm3xZt92Qh!fRAp4wLkN8sX0cTe6VuY1oGz5rH@MiPqDaE';

const headers = {
  'Authorization': `Bearer ${API_TOKEN}`,
  'Content-Type': 'application/json',
};

// Información general de la máquina
export const fetchMiMaquina = async (imei: string) => {
  const response = await fetch(`${API_BASE_URL}/mi-maquina/${imei}`, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Error ${response.status}: No se pudo obtener la información de la máquina`);
  }

  return response.json();
};

// Resumen de ventas
export const fetchVentasResumen = async (imei: string) => {
  const response = await fetch(`${API_BASE_URL}/ventas-resumen/${imei}`, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Error ${response.status}: No se pudo obtener el resumen de ventas`);
  }

  return response.json();
};

// Helper to decode HTML entities from API responses
const decodeHtml = (text: string): string => {
  if (!text || typeof window === 'undefined') return text || '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

// Detalle de ventas (legacy endpoint)
export const fetchVentasDetalle = async (imei: string, fecha?: string) => {
  let url = `${API_BASE_URL}/ventas-detalle/${imei}`;
  if (fecha) {
    url += `?fecha=${fecha}`;
  }
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Error ${response.status}: No se pudo obtener el detalle de ventas`);
  }

  const data = await response.json();
  
  // Decode HTML entities in product names and topping names
  if (data?.ventas && Array.isArray(data.ventas)) {
    data.ventas = data.ventas.map((v: any) => ({
      ...v,
      producto: decodeHtml(v.producto || ''),
      toppings: Array.isArray(v.toppings) 
        ? v.toppings.map((t: any) => ({ ...t, nombre: decodeHtml(t.nombre || '') }))
        : v.toppings,
    }));
  }
  
  return data;
};

// Ordenes del fabricante (endpoint principal con método de pago real y toppings correctos)
export const fetchOrdenes = async (imei: string, fecha?: string) => {
  let url = `https://nonstopmachine.com/wp-json/fabricante-ext/v1/ordenes/${imei}`;
  if (fecha) {
    url += `?fecha=${fecha}`;
  }
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Error ${response.status}: No se pudo obtener las órdenes`);
  }

  const data = await response.json();
  
  // Normalize: API returns "ordenes" array, map to "ventas" for compatibility
  const ordenes = data?.ordenes || data?.ventas || [];
  const normalized = {
    mac_addr: data.imei || imei,
    fecha: (data.fecha || '').substring(0, 10),
    total_ventas: data.total || ordenes.length,
    ventas: ordenes.map((v: any) => ({
      ...v,
      producto: decodeHtml(v.producto || ''),
      fecha: (v.fecha || data.fecha || '').substring(0, 10),
      cantidad_unidades: v.cantidad || v.cantidad_unidades || 1,
      toppings: Array.isArray(v.toppings) 
        ? v.toppings.map((t: any) => ({ ...t, nombre: decodeHtml(t.nombre || '') }))
        : v.toppings || [],
    })),
  };
  
  return normalized;
};

// Stock de toppings
export const fetchToppings = async (imei: string) => {
  const response = await fetch(`${API_BASE_URL}/toppings/${imei}`, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Error ${response.status}: No se pudo obtener el stock de toppings`);
  }

  return response.json();
};

// Temperatura
export const fetchTemperatura = async (imei: string) => {
  const response = await fetch(`${API_BASE_URL}/temperatura/${imei}`, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Error ${response.status}: No se pudo obtener la temperatura`);
  }

  return response.json();
};

// Estadísticas de toppings
export const fetchEstadisticasToppings = async (imei: string) => {
  const response = await fetch(`${API_BASE_URL}/estadisticas-toppings/${imei}`, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Error ${response.status}: No se pudieron obtener las estadísticas`);
  }

  return response.json();
};

// Estado de la máquina
export const fetchEstadoMaquina = async (imei: string) => {
  const response = await fetch(
    `https://nonstopmachine.com/wp-json/fabricante-ext/v1/estado/${imei}`,
    { headers }
  );
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Error ${response.status}: No se pudo obtener el estado`);
  }

  return response.json();
};

// Validar IMEI (15 dígitos numéricos)
export const validarIMEI = (imei: string): boolean => {
  const soloNumeros = imei.replace(/\D/g, '');
  return soloNumeros.length === 15;
};
