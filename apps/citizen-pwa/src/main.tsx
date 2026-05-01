import 'leaflet/dist/leaflet.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import { QueryProvider, initializeQueryClient } from './lib/query-client'
import './styles/globals.css'

await initializeQueryClient()

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err: unknown) => {
      console.error('Service worker registration failed:', err)
    })
  })
}

/* ── PWA install prompt ── */
let deferredInstallPrompt: Event | null = null

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredInstallPrompt = e
  // Consumers can check window.deferredInstallPrompt to show custom install UI
})

// Expose for app code (e.g., SettingsPage)
// @ts-expect-error — attaching to window for cross-module access
window.deferredInstallPrompt = deferredInstallPrompt
