import 'leaflet/dist/leaflet.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import './styles/globals.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  async function registerSW(attemptsLeft = 3): Promise<void> {
    try {
      await navigator.serviceWorker.register('/sw.js')
    } catch (err: unknown) {
      const attempt = 4 - attemptsLeft
      console.error(`SW registration failed (attempt ${String(attempt)}/3):`, err)
      if (attemptsLeft > 1) {
        await new Promise<void>((r) => {
          setTimeout(r, attempt * 1000)
        })
        return registerSW(attemptsLeft - 1)
      }
      window.dispatchEvent(new CustomEvent('sw-registration-failed'))
    }
  }
  window.addEventListener('load', () => {
    void registerSW()
  })
}

/* ── PWA install prompt ── */
window.deferredInstallPrompt = null

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.deferredInstallPrompt = e as BeforeInstallPromptEvent
})

window.addEventListener('appinstalled', () => {
  window.deferredInstallPrompt = null
})
