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
  installError: string | null
}

const DISMISSED_KEY = 'pwa_install_dismissed'
const INSTALL_ERROR_NOT_AVAILABLE = 'Installation is not available right now.'
const INSTALL_ERROR_FAILED = 'Installation failed. Please try again.'

export function usePWAInstall(): UsePWAInstallResult {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)
  const [wasDismissed, setWasDismissed] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem(DISMISSED_KEY) === 'true'
  )

  // Check if running in standalone mode (installed PWA)
  const isStandalone = typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: standalone)').matches

  useEffect(() => {
    if (wasDismissed || isStandalone) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', handler)

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
    if (!deferredPrompt) {
      setInstallError(INSTALL_ERROR_NOT_AVAILABLE)
      return false
    }

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        setIsInstalled(true)
        setInstallError(null)
      }
      setDeferredPrompt(null)
      localStorage.removeItem(DISMISSED_KEY)
      return outcome === 'accepted'
    } catch (error) {
      console.error('Failed to install PWA:', error)
      setInstallError(INSTALL_ERROR_FAILED)
      return false
    }
  }, [deferredPrompt])

  const dismissBanner = useCallback(() => {
    setDeferredPrompt(null)
    setInstallError(null)
    setWasDismissed(true)
    localStorage.setItem(DISMISSED_KEY, 'true')
  }, [])

  return {
    deferredPrompt,
    isInstalled: isInstalled || isStandalone,
    isStandalone,
    installApp,
    dismissBanner,
    installError,
  }
}
