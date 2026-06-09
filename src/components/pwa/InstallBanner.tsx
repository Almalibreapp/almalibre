import { useState, useEffect } from 'react'
import { X, Download, Share, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'almalibre_install_dismissed_at'
const DISMISS_DAYS = 7

const isIos = () => {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const iPadOS = /Mac/.test(ua) && 'ontouchend' in document
  return /iPad|iPhone|iPod/.test(ua) || iPadOS
}

const isInStandaloneMode = () => {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS legacy
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

const wasRecentlyDismissed = () => {
  try {
    const ts = localStorage.getItem(DISMISS_KEY)
    if (!ts) return false
    const diff = Date.now() - parseInt(ts, 10)
    return diff < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

export const InstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosBanner, setShowIosBanner] = useState(false)
  const [showIosModal, setShowIosModal] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isInStandaloneMode() || wasRecentlyDismissed()) {
      setDismissed(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS Safari has no beforeinstallprompt — show our own banner
    if (isIos()) {
      // Small delay so it doesn't pop instantly
      const t = setTimeout(() => setShowIosBanner(true), 1500)
      return () => {
        clearTimeout(t)
        window.removeEventListener('beforeinstallprompt', handler)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString())
    } catch {
      // noop
    }
    setDismissed(true)
    setShowIosBanner(false)
    setShowIosModal(false)
  }

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  if (dismissed) return null

  // Android / Desktop with native prompt
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 bg-background border rounded-xl shadow-lg p-4 flex items-center gap-3 animate-in slide-in-from-bottom duration-300 md:bottom-8 md:left-auto md:right-8 md:w-96">
        <div className="flex-1">
          <p className="font-medium text-sm">Instalar Almalibre</p>
          <p className="text-xs text-muted-foreground">Añade la app a tu pantalla de inicio para acceso rápido</p>
        </div>
        <Button size="sm" onClick={handleInstall} className="shrink-0">
          <Download className="h-4 w-4 mr-1" />
          Instalar
        </Button>
        <Button variant="ghost" size="icon" className="shrink-0" onClick={dismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  // iOS Safari banner
  if (showIosBanner) {
    return (
      <>
        <div className="fixed bottom-20 left-4 right-4 z-50 bg-background border rounded-xl shadow-lg p-4 flex items-center gap-3 animate-in slide-in-from-bottom duration-300 md:bottom-8 md:left-auto md:right-8 md:w-96">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Instalar Almalibre</p>
            <p className="text-xs text-muted-foreground">Recibe notificaciones y acceso rápido</p>
          </div>
          <Button size="sm" onClick={() => setShowIosModal(true)} className="shrink-0">
            Cómo
          </Button>
          <Button variant="ghost" size="icon" className="shrink-0" onClick={dismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {showIosModal && (
          <div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center animate-in fade-in duration-200"
            onClick={() => setShowIosModal(false)}
          >
            <div
              className="bg-background border rounded-t-2xl md:rounded-2xl w-full md:max-w-md p-6 animate-in slide-in-from-bottom duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg">Instalar en iPhone</h2>
                <Button variant="ghost" size="icon" onClick={() => setShowIosModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <p className="text-sm text-muted-foreground mb-5">
                Safari requiere 2 pasos para instalar la app y activar notificaciones:
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Toca el botón Compartir</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Está en la barra inferior de Safari
                    </p>
                    <div className="inline-flex items-center gap-2 bg-muted px-3 py-2 rounded-lg">
                      <Share className="h-4 w-4 text-blue-500" />
                      <span className="text-xs">Compartir</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Selecciona "Añadir a inicio"</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Desliza hacia abajo en el menú
                    </p>
                    <div className="inline-flex items-center gap-2 bg-muted px-3 py-2 rounded-lg">
                      <span className="text-xs">Añadir a pantalla de inicio</span>
                      <Plus className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Abre la app desde el icono</p>
                    <p className="text-xs text-muted-foreground">
                      Una vez instalada, ábrela desde tu pantalla de inicio y activa las notificaciones en Ajustes → Notificaciones.
                    </p>
                  </div>
                </div>
              </div>

              <Button className="w-full mt-6" onClick={dismiss}>
                Entendido
              </Button>
            </div>
          </div>
        )}
      </>
    )
  }

  return null
}
