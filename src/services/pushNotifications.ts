import { PushNotifications } from '@capacitor/push-notifications';
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
 * Inicializa el sistema de notificaciones push
 * Solo funciona en dispositivos nativos (Android/iOS)
 */
export const initPushNotifications = async () => {
  // Solo ejecutar en dispositivos nativos, no en web
  if (Capacitor.getPlatform() === 'web') {
    console.log('Push notifications not available on web platform');
    return { success: false, reason: 'web_platform' };
  }

  try {
    // Verificar si ya tenemos permisos
    let permStatus = await PushNotifications.checkPermissions();
    
    if (permStatus.receive === 'prompt') {
      // Solicitar permisos si aún no se han concedido
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('Push notification permission not granted');
      return { success: false, reason: 'permission_denied' };
    }

    // Registrar el dispositivo para recibir push
    await PushNotifications.register();

    // Configurar listeners
    setupPushListeners();

    return { success: true };
  } catch (error) {
    console.error('Error initializing push notifications:', error);
    return { success: false, reason: 'error', error };
  }
};

/**
 * Configura los listeners para eventos de notificaciones push
 */
const setupPushListeners = () => {
  // Listener: Cuando se obtiene el token del dispositivo
  PushNotifications.addListener('registration', async (token) => {
    console.log('Push registration success, token:', token.value);
    await saveDeviceToken(token.value);
  });

  // Listener: Error en registro
  PushNotifications.addListener('registrationError', (error) => {
    console.error('Error on push registration:', JSON.stringify(error));
  });

  // Listener: Notificación recibida con app en primer plano
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push notification received:', notification);
    showInAppNotification(notification);
  });

  // Listener: Usuario toca la notificación
  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('Push notification action performed:', notification);
    handleNotificationTap(notification.notification.data as PushNotificationData);
  });
};

/**
 * Guarda el token del dispositivo en Supabase
 */
const saveDeviceToken = async (token: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('No user logged in, cannot save device token');
      return;
    }

    const platform = Capacitor.getPlatform();
    
    const { error } = await supabase
      .from('dispositivos_usuario')
      .upsert({
        usuario_id: user.id,
        token_push: token,
        plataforma: platform,
        activo: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'usuario_id,plataforma'
      });

    if (error) {
      console.error('Error saving device token:', error);
    } else {
      console.log('Device token saved successfully');
    }
  } catch (error) {
    console.error('Error in saveDeviceToken:', error);
  }
};

/**
 * Maneja la navegación cuando el usuario toca una notificación
 */
const handleNotificationTap = (data: PushNotificationData) => {
  if (!data?.tipo) return;

  switch (data.tipo) {
    case 'stock_bajo':
      if (data.maquina_id) {
        window.location.href = `/machine/${data.maquina_id}`;
      }
      break;
    case 'temperatura_alerta':
      if (data.maquina_id) {
        window.location.href = `/machine/${data.maquina_id}`;
      }
      break;
    case 'pedido_actualizado':
      window.location.href = '/orders';
      break;
    case 'incidencia_actualizada':
      window.location.href = '/incidents';
      break;
    case 'nueva_venta':
      if (data.maquina_id) {
        window.location.href = `/machine/${data.maquina_id}`;
      }
      break;
    case 'promocion':
      window.location.href = '/promotions';
      break;
    default:
      window.location.href = '/';
  }
};

/**
 * Muestra una notificación in-app cuando la app está en primer plano
 */
const showInAppNotification = (notification: { title?: string; body?: string; data?: unknown }) => {
  const title = notification.title || 'Nueva notificación';
  const body = notification.body || '';
  
  toast(title, {
    description: body,
    duration: 5000,
    action: {
      label: 'Ver',
      onClick: () => {
        const data = notification.data as PushNotificationData;
        if (data) {
          handleNotificationTap(data);
        }
      }
    }
  });
};

/**
 * Desactiva el token del dispositivo actual (útil al cerrar sesión)
 */
export const deactivateDeviceToken = async () => {
  if (Capacitor.getPlatform() === 'web') return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const platform = Capacitor.getPlatform();
    
    await supabase
      .from('dispositivos_usuario')
      .update({ activo: false })
      .eq('usuario_id', user.id)
      .eq('plataforma', platform);
      
  } catch (error) {
    console.error('Error deactivating device token:', error);
  }
};

/**
 * Verifica si las notificaciones push están disponibles y habilitadas
 */
export const checkPushNotificationStatus = async () => {
  if (Capacitor.getPlatform() === 'web') {
    return { available: false, enabled: false, platform: 'web' };
  }

  try {
    const permStatus = await PushNotifications.checkPermissions();
    return {
      available: true,
      enabled: permStatus.receive === 'granted',
      platform: Capacitor.getPlatform()
    };
  } catch (error) {
    return { available: false, enabled: false, platform: Capacitor.getPlatform(), error };
  }
};
