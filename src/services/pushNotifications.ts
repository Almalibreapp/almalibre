import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type NotificationType = 
  | 'stock_bajo' 
  | 'temperatura_alerta' 
  | 'nueva_venta' 
  | 'pedido_actualizado' 
  | 'incidencia_actualizada' 
  | 'promocion';

export interface PushNotificationData {
  tipo: NotificationType;
  maquina_id?: string;
  pedido_id?: string;
  incidencia_id?: string;
  promocion_id?: string;
  [key: string]: unknown;
}

/**
 * Stub — push notifications have been removed (no Firebase).
 * Local notifications handle all alerting via @capacitor/local-notifications.
 */
export const initPushNotifications = async () => {
  console.log('Push notifications disabled (local-only mode)');
  return { success: false, reason: 'disabled' };
};

export const deactivateDeviceToken = async () => {
  // no-op
};

export const checkPushNotificationStatus = async () => {
  return { available: false, enabled: false, platform: Capacitor.getPlatform() };
};
