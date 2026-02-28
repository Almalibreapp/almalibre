import { useEffect, useRef } from 'react';
import { checkAndNotify, updateLocalNotifPrefs, resetLocalNotifState } from '@/services/localNotifications';
import { usePreferenciasNotificaciones } from '@/hooks/useNotificaciones';

/**
 * Hook that monitors machine data and triggers local notifications
 * when sales increase, temperature is high, or machine is depleted.
 * 
 * Only fires on native platforms when app is in background.
 */
export const useLocalNotifications = (
  ventas: any[] | undefined,
  temperatura: number | undefined | null,
  estado: string | undefined,
  imei: string | undefined
) => {
  const prevImei = useRef(imei);
  const { preferencias } = usePreferenciasNotificaciones();

  // Sync user preferences to the service
  useEffect(() => {
    updateLocalNotifPrefs({
      nuevas_ventas: preferencias.nuevas_ventas,
      temperatura_alerta: preferencias.temperatura_alerta,
      stock_bajo: preferencias.stock_bajo,
    });
  }, [preferencias.nuevas_ventas, preferencias.temperatura_alerta, preferencias.stock_bajo]);

  // Reset state when machine changes
  useEffect(() => {
    if (imei !== prevImei.current) {
      resetLocalNotifState();
      prevImei.current = imei;
    }
  }, [imei]);

  // Check and notify on data changes
  useEffect(() => {
    if (!imei) return;
    checkAndNotify(ventas, temperatura, estado);
  }, [ventas, temperatura, estado, imei]);
};
