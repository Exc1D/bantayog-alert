/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

interface Window {
  deferredInstallPrompt: BeforeInstallPromptEvent | null
}
