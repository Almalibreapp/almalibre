import { Capacitor } from '@capacitor/core'
import { supabase } from '@/integrations/supabase/client'

export type NotificationType =
  | 'stock_bajo'
  | 'temperatura_alerta'
  | 'nueva_venta'
  | 'pedido_actualizado'
  | 'incidencia_actualizada'
  | 'promocion'

export interface PushNotificationData {
  tipo: NotificationType
  maquina_id?: string
  pedido_id?: string
  incidencia_id?: string
  promocion_id?: string
  [key: string]: unknown
}

const VAPID_PUBLIC_KEY =
  'BCQj1nB2ffnnBOHgEMixM1NOGDjPZKaWom_bW4wDWRovmnSolXiFYGY-gLYG8qw1X0XlLm3W5JgNVMp4wotEKiw'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export const initPushNotifications = async () => {
  if (typeof window === 'undefined') {
    return { success: false, reason: 'ssr' }
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications not supported')
    return { success: false, reason: 'not_supported' }
  }

  // Skip in Lovable preview / iframe
  if (window.location.hostname.includes('lovable') || window.self !== window.top) {
    return { success: false, reason: 'preview' }
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js')
    await registration.update()

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { success: false, reason: 'permission_denied' }
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, reason: 'not_authenticated' }
    }

    const subJson = subscription.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
        platform: Capacitor.getPlatform() === 'web' ? 'web' : Capacitor.getPlatform(),
      },
      { onConflict: 'user_id,endpoint' }
    )

    if (error) {
      console.error('Error saving push subscription:', error)
      return { success: false, reason: 'db_error' }
    }

    return { success: true }
  } catch (err) {
    console.error('Push init error:', err)
    return { success: false, reason: 'init_error' }
  }
}

export const deactivateDeviceToken = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await subscription.unsubscribe()
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
    }
  } catch (err) {
    console.error('Push deactivation error:', err)
  }
}

export const checkPushNotificationStatus = async () => {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return { available: false, enabled: false, platform: Capacitor.getPlatform() }
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return {
      available: true,
      enabled: !!subscription,
      platform: Capacitor.getPlatform(),
    }
  } catch {
    return { available: true, enabled: false, platform: Capacitor.getPlatform() }
  }
}
