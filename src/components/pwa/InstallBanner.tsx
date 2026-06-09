import { useState, useEffect } from 'react'
import { X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const InstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setDismissed(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  if (!deferredPrompt || dismissed) return null

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
      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setDismissed(true)}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
