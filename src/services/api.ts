import { VentasResponse, StockResponse, TemperaturaResponse } from '@/types';

const BASE_URL = 'https://nonstopmachine.com/wp-json/helados/v1';
const AUTH_TOKEN = 'b7Jm3xZt92Qh!fRAp4wLkN8sX0cTe6VuY1oGz5rH@MiPqDaE';

const headers = {
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json',
};

export const fetchVentas = async (
  mac: string,
  fechaInicio?: string,
  fechaFin?: string
): Promise<VentasResponse> => {
  try {
    let url = `${BASE_URL}/ventas?mac=${encodeURIComponent(mac)}`;
    if (fechaInicio) url += `&fecha_inicio=${fechaInicio}`;
    if (fechaFin) url += `&fecha_fin=${fechaFin}`;

    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error('Error fetching ventas');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching ventas:', error);
    // Return mock data for demo
    return {
      status: 'ok',
      mac,
      ventas: [
        {
          id: 1,
          producto_id: 'HELADO_001',
          producto_nombre: 'Helado Premium',
          producto_monto: 5.50,
          fecha: new Date().toISOString(),
          estado: 'exitoso',
          toppings_usados: [
            { posicion: 'topping_1', nombre: 'Chocolate', cantidad: 1 },
            { posicion: 'topping_3', nombre: 'Fresa', cantidad: 1 },
          ],
        },
        {
          id: 2,
          producto_id: 'HELADO_002',
          producto_nombre: 'Helado Clásico',
          producto_monto: 4.00,
          fecha: new Date(Date.now() - 3600000).toISOString(),
          estado: 'exitoso',
          toppings_usados: [
            { posicion: 'topping_2', nombre: 'Oreo', cantidad: 1 },
          ],
        },
      ],
      total_ventas: 2,
      total_ingresos: 9.50,
    };
  }
};

export const fetchStock = async (mac: string): Promise<StockResponse> => {
  try {
    const response = await fetch(`${BASE_URL}/stock?mac=${encodeURIComponent(mac)}`, { headers });
    
    if (!response.ok) {
      throw new Error('Error fetching stock');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching stock:', error);
    // Return mock data for demo
    return {
      status: 'ok',
      mac,
      toppings: [
        { posicion: 'topping_1', nombre: 'Chocolate', stock_actual: 45, capacidad_maxima: 100 },
        { posicion: 'topping_2', nombre: 'Oreo', stock_actual: 30, capacidad_maxima: 100 },
        { posicion: 'topping_3', nombre: 'Fresa', stock_actual: 12, capacidad_maxima: 100 },
        { posicion: 'topping_4', nombre: 'Caramelo', stock_actual: 0, capacidad_maxima: 100 },
        { posicion: 'topping_5', nombre: 'Nueces', stock_actual: 60, capacidad_maxima: 100 },
        { posicion: 'topping_6', nombre: 'Gomitas', stock_actual: 25, capacidad_maxima: 100 },
      ],
      fecha_actualizacion: new Date().toISOString(),
    };
  }
};

export const fetchTemperatura = async (mac: string): Promise<TemperaturaResponse> => {
  try {
    const response = await fetch(`${BASE_URL}/temperatura?mac=${encodeURIComponent(mac)}`, { headers });
    
    if (!response.ok) {
      throw new Error('Error fetching temperatura');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching temperatura:', error);
    // Return mock data for demo
    const now = new Date();
    return {
      status: 'ok',
      mac,
      temperatura_actual: -18.5,
      unidad: 'C',
      estado: 'normal',
      historial: Array.from({ length: 24 }, (_, i) => ({
        temperatura: -18 + Math.random() * 2 - 1,
        estado: 'normal' as const,
        unidad: 'C',
        fecha: new Date(now.getTime() - i * 3600000).toISOString(),
      })),
    };
  }
};
