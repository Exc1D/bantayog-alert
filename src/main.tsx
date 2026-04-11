import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { App } from './app/App'
import { registerServiceWorker } from './shared/utils/serviceWorkerRegistration'

// Register service worker for PWA functionality
registerServiceWorker('/sw.js', {
  onSuccess: () => {
    console.log('[App] Service worker registered successfully');
  },
  onUpdate: () => {
    console.log('[App] New content is available; please refresh');
    // You can show a notification to the user here
  },
  onError: (error) => {
    console.error('[App] Service worker registration failed:', error);
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
