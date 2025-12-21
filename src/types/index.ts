export interface Profile {
  id: string;
  email: string;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  nif_cif: string | null;
  nombre_empresa: string | null;
  foto_url: string | null;
  created_at: string;
}

export interface Maquina {
  id: string;
  usuario_id: string;
  mac_address: string; // Este campo almacena el IMEI
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
  toppings_usados?: ToppingUsado[];
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

// Respuesta de ventas-resumen
export interface VentasResumenResponse {
  imei: string;
  total_ventas: number;
  total_ingresos: number;
  ticket_promedio: number;
  periodo?: string;
}

// Respuesta de ventas-detalle
export interface VentasDetalleResponse {
  imei: string;
  ventas: Venta[];
  total_ventas: number;
  total_ingresos: number;
}

// Respuesta de toppings
export interface ToppingsResponse {
  imei: string;
  toppings: Topping[];
  fecha_actualizacion: string;
}

// Respuesta de temperatura
export interface TemperaturaResponse {
  imei: string;
  temperatura_actual: number;
  unidad: string;
  estado: 'normal' | 'alerta' | 'critico';
  historial?: Temperatura[];
}

// Respuesta de mi-maquina
export interface MiMaquinaResponse {
  imei: string;
  nombre?: string;
  ubicacion?: string;
  estado?: string;
  ultimo_reporte?: string;
}

// Respuesta de estadisticas-toppings
export interface EstadisticasToppingsResponse {
  imei: string;
  estadisticas: {
    posicion: string;
    nombre: string;
    total_usado: number;
    porcentaje_uso: number;
  }[];
}

// Legacy types for backwards compatibility
export interface VentasResponse {
  status?: string;
  mac?: string;
  imei?: string;
  ventas: Venta[];
  total_ventas: number;
  total_ingresos: number;
}

export interface StockResponse {
  status?: string;
  mac?: string;
  imei?: string;
  toppings: Topping[];
  fecha_actualizacion: string;
}
