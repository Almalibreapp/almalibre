self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => event.waitUntil(clients.claim()))

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title || 'Almalibre'
  const options = {
    body: data.body || 'Nueva notificación',
    icon: data.icon || '/logo-almalibre.png',
    badge: data.badge || '/favicon.ico',
    tag: data.tag || 'default',
    requireInteraction: false,
    data: {
      url: data.url || '/'
    }
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})
