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

// Respuesta de temperatura - ESTRUCTURA REAL
export interface TemperaturaResponse {
  mac_addr: string;
  temperatura: number;
  unidad: string;
  estado: 'normal' | 'alerta' | 'critico';
  timestamp: string;
}

// Respuesta de ventas-resumen - ESTRUCTURA REAL
export interface VentasResumenResponse {
  mac_addr: string;
  ventas_hoy: {
    cantidad: number;
    total_euros: number;
  };
  ventas_ayer: {
    cantidad: number;
    total_euros: number;
  };
  ventas_mes: {
    cantidad: number;
    total_euros: number;
  };
}

// Topping en una venta
export interface ToppingVenta {
  posicion: string;
  nombre: string;
  cantidad: string;
}

// Venta individual - ESTRUCTURA REAL
export interface Venta {
  id: string;
  hora: string;
  producto: string;
  precio: number;
  estado: string;
  toppings: ToppingVenta[];
}

// Respuesta de ventas-detalle - ESTRUCTURA REAL
export interface VentasDetalleResponse {
  mac_addr: string;
  fecha: string;
  total_ventas: number;
  ventas: Venta[];
}

// Topping en stock
export interface Topping {
  posicion: string;
  nombre: string;
  stock_actual: number;
  capacidad_maxima: number;
}

// Respuesta de toppings - ESTRUCTURA REAL
export interface ToppingsResponse {
  mac_addr: string;
  toppings: Topping[];
  total_toppings: number;
}

// Respuesta de mi-maquina
export interface MiMaquinaResponse {
  mac_addr: string;
  nombre?: string;
  ubicacion?: string;
  estado?: string;
  ultimo_reporte?: string;
}

// Respuesta de estadisticas-toppings
export interface EstadisticasToppingsResponse {
  mac_addr: string;
  estadisticas: {
    posicion: string;
    nombre: string;
    total_usado: number;
    porcentaje_uso: number;
  }[];
}
