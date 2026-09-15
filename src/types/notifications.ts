export type NotificationType = 
  | 'stock_bajo' 
  | 'temperatura_alerta' 
  | 'nueva_venta' 
  | 'pedido_actualizado' 
  | 'promocion';

export interface Notificacion {
  id: string;
  usuario_id: string;
  titulo: string;
  mensaje: string;
  tipo: NotificationType;
  datos: Record<string, unknown>;
  leida: boolean;
  enviada: boolean;
  fecha_envio: string | null;
  created_at: string;
}

export interface PreferenciasNotificaciones {
  id: string;
  usuario_id: string;
  stock_bajo: boolean;
  temperatura_alerta: boolean;
  nuevas_ventas: boolean;
  pedidos: boolean;
  promociones: boolean;
  canal_push: boolean;
  canal_email: boolean;
  umbral_stock: number;
  updated_at: string;
}

export interface DispositivoUsuario {
  id: string;
  usuario_id: string;
  token_push: string;
  plataforma: 'android' | 'ios' | 'web';
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, {
  icon: string;
  color: string;
  label: string;
}> = {
  stock_bajo: {
    icon: '⚠️',
    color: 'text-amber-500',
    label: 'Stock bajo'
  },
  temperatura_alerta: {
    icon: '🌡️',
    color: 'text-red-500',
    label: 'Alerta de temperatura'
  },
  nueva_venta: {
    icon: '💰',
    color: 'text-green-500',
    label: 'Nueva venta'
  },
  pedido_actualizado: {
    icon: '📦',
    color: 'text-blue-500',
    label: 'Pedido actualizado'
  },
  promocion: {
    icon: '🎉',
    color: 'text-pink-500',
    label: 'Promoción'
  }
};
