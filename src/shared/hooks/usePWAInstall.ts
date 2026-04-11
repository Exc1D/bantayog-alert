/**
 * usePWAInstall Hook
 *
 * Manages PWA installation prompt.
 * Captures the beforeinstallprompt event and triggers install dialog.
 */

import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface UsePWAInstallResult {
  deferredPrompt: BeforeInstallPromptEvent | null
  isInstalled: boolean
  isStandalone: boolean
  installApp: () => Promise<boolean>
  dismissBanner: () => void
}

const DISMISSED_KEY = 'pwa_install_dismissed'

export function usePWAInstall(): UsePWAInstallResult {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  // Check if running in standalone mode (installed PWA)
  const isStandalone = typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: standalone)').matches

  // Check if user previously dismissed the banner
  const wasDismissed = typeof window !== 'undefined' &&
    localStorage.getItem(DISMISSED_KEY) === 'true'

  useEffect(() => {
    // If already dismissed or already installed, don't show banner
    if (wasDismissed || isStandalone) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', handler)

      // Check if already installed
      if (isStandalone) {
        setIsInstalled(true)
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeinstallprompt', handler)
      }
    }
  }, [isStandalone, wasDismissed])

  const installApp = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        setIsInstalled(true)
      }
      setDeferredPrompt(null)
      localStorage.removeItem(DISMISSED_KEY)
      return outcome === 'accepted'
    } catch (error) {
      console.error('Failed to install PWA:', error)
      return false
    }
  }, [deferredPrompt])

  const dismissBanner = useCallback(() => {
    setDeferredPrompt(null)
    localStorage.setItem(DISMISSED_KEY, 'true')
  }, [])

  return {
    deferredPrompt,
    isInstalled: isInstalled || isStandalone,
    isStandalone,
    installApp,
    dismissBanner,
  }
}
