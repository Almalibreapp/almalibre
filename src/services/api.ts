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
  let url = `${BASE_URL}/ventas?mac=${encodeURIComponent(mac)}`;
  if (fechaInicio) url += `&fecha_inicio=${fechaInicio}`;
  if (fechaFin) url += `&fecha_fin=${fechaFin}`;

  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Error ${response.status}: No se pudieron obtener las ventas`);
  }

  return await response.json();
};

export const fetchStock = async (mac: string): Promise<StockResponse> => {
  const response = await fetch(`${BASE_URL}/stock?mac=${encodeURIComponent(mac)}`, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Error ${response.status}: No se pudo obtener el stock`);
  }

  return await response.json();
};

export const fetchTemperatura = async (mac: string): Promise<TemperaturaResponse> => {
  const response = await fetch(`${BASE_URL}/temperatura?mac=${encodeURIComponent(mac)}`, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Error ${response.status}: No se pudo obtener la temperatura`);
  }

  return await response.json();
};
