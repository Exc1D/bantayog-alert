import { useCallback, useEffect, useMemo, useState } from 'react'

const DISMISSAL_KEY_PREFIX = 'bantayog.installPrompt.dismissed.'
const STANDALONE_MEDIA_QUERY = '(display-mode: standalone)'

type InstallPromptChoice = Awaited<BeforeInstallPromptEvent['userChoice']>
type InstallPromptPlatform = 'chromium' | 'ios' | 'unsupported'

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean
}

interface UseInstallPromptOptions {
  surface: string
}

interface UseInstallPromptResult {
  canInstall: boolean
  dismissInstallPrompt: () => void
  isInstalled: boolean
  platform: InstallPromptPlatform
  promptInstall: () => Promise<InstallPromptChoice | null>
}

function getDismissalKey(surface: string) {
  return `${DISMISSAL_KEY_PREFIX}${surface}`
}

function readDismissed(surface: string) {
  try {
    return localStorage.getItem(getDismissalKey(surface)) === '1'
  } catch (error) {
    console.warn('Unable to read install prompt dismissal state.', error)
    return false
  }
}

function writeDismissed(surface: string) {
  try {
    localStorage.setItem(getDismissalKey(surface), '1')
  } catch (error) {
    console.warn('Unable to persist install prompt dismissal state.', error)
  }
}

function isStandaloneDisplayMode() {
  const navigatorWithStandalone = navigator as NavigatorWithStandalone
  return (
    window.matchMedia(STANDALONE_MEDIA_QUERY).matches || navigatorWithStandalone.standalone === true
  )
}

function isIosLike() {
  const userAgent = navigator.userAgent.toLowerCase()
  const platform = navigator.platform.toLowerCase()
  return (
    /iphone|ipad|ipod/.test(userAgent) || (platform === 'macintel' && navigator.maxTouchPoints > 1)
  )
}

export function useInstallPrompt({ surface }: UseInstallPromptOptions): UseInstallPromptResult {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => window.deferredInstallPrompt ?? null,
  )
  const [isInstalled, setIsInstalled] = useState(isStandaloneDisplayMode)
  const [dismissed, setDismissed] = useState(() => readDismissed(surface))

  useEffect(() => {
    const next = readDismissed(surface)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed((prev) => (next !== prev ? next : prev))
  }, [surface])

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      const promptEvent = event as BeforeInstallPromptEvent
      window.deferredInstallPrompt = promptEvent
      setDeferredPrompt(promptEvent)
      setIsInstalled(false)
    }

    function handleAppInstalled() {
      window.deferredInstallPrompt = null
      setDeferredPrompt(null)
      setIsInstalled(true)
    }

    const displayModeQuery = window.matchMedia(STANDALONE_MEDIA_QUERY)
    const handleDisplayModeChange = () => {
      setIsInstalled(isStandaloneDisplayMode())
    }

    const hasAddEventListener = 'addEventListener' in displayModeQuery
    const addListener = (event: string, handler: EventListener) => {
      if (hasAddEventListener) {
        displayModeQuery.addEventListener(event, handler)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        ;(
          displayModeQuery as MediaQueryList & { addListener: (handler: EventListener) => void }
        ).addListener(handler)
      }
    }
    const removeListener = (event: string, handler: EventListener) => {
      if (hasAddEventListener) {
        displayModeQuery.removeEventListener(event, handler)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        ;(
          displayModeQuery as MediaQueryList & { removeListener: (handler: EventListener) => void }
        ).removeListener(handler)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    addListener('change', handleDisplayModeChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      removeListener('change', handleDisplayModeChange)
    }
  }, [])

  const platform = useMemo<InstallPromptPlatform>(() => {
    if (deferredPrompt) return 'chromium'
    if (isIosLike()) return 'ios'
    return 'unsupported'
  }, [deferredPrompt])

  const canInstall = !isInstalled && !dismissed && platform !== 'unsupported'

  const dismissInstallPrompt = useCallback(() => {
    writeDismissed(surface)
    setDismissed(true)
  }, [surface])

  const promptInstall = useCallback(async () => {
    const promptEvent = deferredPrompt ?? window.deferredInstallPrompt
    if (!promptEvent || isInstalled) return null

    try {
      await promptEvent.prompt()
      const choice = await promptEvent.userChoice
      if (choice.outcome === 'dismissed') {
        writeDismissed(surface)
        setDismissed(true)
      }
      return choice
    } catch (error) {
      console.warn('Install prompt failed.', error)
      return null
    } finally {
      window.deferredInstallPrompt = null
      setDeferredPrompt(null)
    }
  }, [deferredPrompt, isInstalled, surface])

  return {
    canInstall,
    dismissInstallPrompt,
    isInstalled,
    platform,
    promptInstall,
  }
}
