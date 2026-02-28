import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// --- State tracking ---
let appIsActive = true;
let lastVentasCount = -1; // -1 = not initialized yet
let lastTemperature: number | null = null;
let lastEstadoAgotado = false;
let permissionsGranted = false;

// Throttle: max 1 notification of each type per 5 minutes
const lastNotificationTime = new Map<string, number>();
const THROTTLE_MS = 5 * 60 * 1000;

function shouldNotify(type: string): boolean {
  const last = lastNotificationTime.get(type);
  const now = Date.now();
  if (!last || now - last > THROTTLE_MS) {
    lastNotificationTime.set(type, now);
    return true;
  }
  return false;
}

// --- Initialization ---

export async function initLocalNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  // Track app active state
  App.addListener('appStateChange', ({ isActive }) => {
    appIsActive = isActive;
  });

  // Request permissions
  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      perm = await LocalNotifications.requestPermissions();
    }
    permissionsGranted = perm.display === 'granted';
    console.log('[LocalNotif] Permissions:', perm.display);
  } catch (e) {
    console.warn('[LocalNotif] Permission error:', e);
  }
}

// --- User preferences (cached locally) ---
interface LocalNotifPrefs {
  nuevas_ventas: boolean;
  temperatura_alerta: boolean;
  stock_bajo: boolean;
}

let userPrefs: LocalNotifPrefs = {
  nuevas_ventas: false,
  temperatura_alerta: true,
  stock_bajo: true,
};

export function updateLocalNotifPrefs(prefs: Partial<LocalNotifPrefs>) {
  userPrefs = { ...userPrefs, ...prefs };
}

// --- Core check function ---

export async function checkAndNotify(
  ventas: any[] | undefined,
  temperatura: number | undefined | null,
  estado: string | undefined
) {
  if (!Capacitor.isNativePlatform() || !permissionsGranted) return;
  // Only notify when app is in background
  if (appIsActive) return;

  const notifications: any[] = [];

  // 1. Nueva venta
  if (userPrefs.nuevas_ventas && ventas) {
    const count = ventas.length;
    if (lastVentasCount >= 0 && count > lastVentasCount) {
      const nuevas = count - lastVentasCount;
      const ultima = ventas[ventas.length - 1]; // latest
      if (shouldNotify('venta')) {
        notifications.push({
          title: '💰 Nueva venta',
          body: ultima
            ? `${ultima.producto || 'Venta'} - €${Number(ultima.precio || 0).toFixed(2)}${nuevas > 1 ? ` (+${nuevas} ventas)` : ''}`
            : `${nuevas} nueva(s) venta(s)`,
          id: Date.now(),
          schedule: { at: new Date(Date.now() + 200) },
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#8CC63F',
        });
      }
    }
    lastVentasCount = count;
  }

  // 2. Temperatura alta (> -15°C)
  if (userPrefs.temperatura_alerta && temperatura != null && typeof temperatura === 'number') {
    if (temperatura > -15 && temperatura !== lastTemperature) {
      if (shouldNotify('temperatura')) {
        notifications.push({
          title: '🌡️ Alerta de temperatura',
          body: `Temperatura: ${temperatura}°C - Verificar refrigeración`,
          id: Date.now() + 1,
          schedule: { at: new Date(Date.now() + 200) },
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#FF0000',
        });
      }
    }
    lastTemperature = temperatura;
  }

  // 3. Máquina agotada
  if (userPrefs.stock_bajo && estado === 'agotado' && !lastEstadoAgotado) {
    if (shouldNotify('agotado')) {
      notifications.push({
        title: '⚠️ Máquina agotada',
        body: 'Reabastecimiento necesario',
        id: Date.now() + 2,
        schedule: { at: new Date(Date.now() + 200) },
        sound: 'default',
        smallIcon: 'ic_stat_icon_config_sample',
        iconColor: '#FFA500',
      });
    }
  }
  lastEstadoAgotado = estado === 'agotado';

  // Schedule all
  if (notifications.length > 0) {
    try {
      await LocalNotifications.schedule({ notifications });
      console.log('[LocalNotif] Scheduled', notifications.length, 'notifications');
    } catch (e) {
      console.warn('[LocalNotif] Schedule error:', e);
    }
  }
}

// Reset counters (e.g. on machine change)
export function resetLocalNotifState() {
  lastVentasCount = -1;
  lastTemperature = null;
  lastEstadoAgotado = false;
}
