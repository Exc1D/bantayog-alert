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
}

export function usePWAInstall(): UsePWAInstallResult {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  // Check if running in standalone mode (installed PWA)
  const isStandalone = typeof window !== 'undefined' &&
    window.matchMedia('(display-mode: standalone)').matches

  useEffect(() => {
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
  }, [isStandalone])

  const installApp = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === 'accepted') {
        setIsInstalled(true)
      }
      setDeferredPrompt(null)
      return outcome === 'accepted'
    } catch (error) {
      console.error('Failed to install PWA:', error)
      return false
    }
  }, [deferredPrompt])

  return {
    deferredPrompt,
    isInstalled: isInstalled || isStandalone,
    isStandalone,
    installApp,
  }
}
