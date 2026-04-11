import { useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from './routes'
import { usePWAInstall } from '@/shared/hooks/usePWAInstall'
import { AgeGate } from '@/shared/components/AgeGate'
import { Download, X } from 'lucide-react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
})

function PWAInstallBanner() {
  const { deferredPrompt, installApp, dismissBanner, installError } = usePWAInstall()

  if (!deferredPrompt) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 bg-primary-red text-white px-4 py-3 z-50 shadow-md"
      data-testid="pwa-install-banner"
    >
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          <p className="text-sm font-medium">Install Bantayog Alert for faster access</p>
        </div>
        <div className="flex items-center gap-2">
          {installError ? (
            <p className="text-sm text-white/90" role="alert" data-testid="pwa-install-error">
              {installError}
            </p>
          ) : (
            <button
              onClick={installApp}
              className="px-4 py-1.5 bg-white text-primary-red rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
              data-testid="pwa-install-button"
            >
              Install
            </button>
          )}
          <button
            onClick={dismissBanner}
            className="p-1.5 text-white/80 hover:text-white transition-colors"
            data-testid="pwa-dismiss-button"
            aria-label="Dismiss banner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function App() {
  const [isAgeVerified, setIsAgeVerified] = useState(false)

  return (
    <QueryClientProvider client={queryClient}>
      <div data-testid="query-client-provider">
        {!isAgeVerified && <AgeGate onVerified={() => setIsAgeVerified(true)} />}
        <PWAInstallBanner />
        <RouterProvider router={router} />
      </div>
    </QueryClientProvider>
  )
}
