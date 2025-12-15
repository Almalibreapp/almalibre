export interface Profile {
  id: string;
  email: string;
  nombre: string;
  telefono: string | null;
  created_at: string;
}

export interface Maquina {
  id: string;
  usuario_id: string;
  mac_address: string;
  nombre_personalizado: string;
  ubicacion: string | null;
  activa: boolean;
  created_at: string;
}

export interface Venta {
  id: number;
  producto_id: string;
  producto_nombre: string;
  producto_monto: number;
  fecha: string;
  estado: 'exitoso' | 'fallido' | 'cancelado';
  toppings_usados: ToppingUsado[];
}

export interface ToppingUsado {
  posicion: string;
  nombre: string;
  cantidad: number;
}

export interface Topping {
  posicion: string;
  nombre: string;
  stock_actual: number;
  capacidad_maxima: number;
}

export interface Temperatura {
  temperatura: number;
  unidad: string;
  estado: 'normal' | 'alerta' | 'critico';
  fecha: string;
}

export interface VentasResponse {
  status: string;
  mac: string;
  ventas: Venta[];
  total_ventas: number;
  total_ingresos: number;
}

export interface StockResponse {
  status: string;
  mac: string;
  toppings: Topping[];
  fecha_actualizacion: string;
}

export interface TemperaturaResponse {
  status: string;
  mac: string;
  temperatura_actual: number;
  unidad: string;
  estado: 'normal' | 'alerta' | 'critico';
  historial: Temperatura[];
}
