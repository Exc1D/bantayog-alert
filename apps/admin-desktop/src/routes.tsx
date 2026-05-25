import { useState, useEffect } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import DashboardPage from './pages/DashboardPage'
import MapPage from './pages/MapPage'
import FeedPage from './pages/FeedPage'
import { DispatchMonitorPage } from './pages/DispatchMonitorPage'
import MobileGate from './pages/MobileGate'
import { LoginPage } from './pages/LoginPage'
import { WindowSyncProvider } from './providers/WindowSyncProvider'
import { ErrorBoundary } from './providers/ErrorBoundary'

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768,
  )

  useEffect(() => {
    const handleResize = () => { setIsMobile(window.innerWidth < 768); }
    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize); }
  }, [])

  return isMobile
}

function IndexRedirect() {
  const isMobile = useIsMobile()
  if (isMobile) return <MobileGate />
  return <Navigate to="/dashboard" replace />
}

function AuthLayout() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-surface)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <WindowSyncProvider>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </WindowSyncProvider>
  )
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <AuthLayout />,
    children: [
      {
        path: '/',
        element: <IndexRedirect />,
      },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/map', element: <MapPage /> },
      { path: '/feed', element: <FeedPage /> },
      { path: '/dispatches', element: <DispatchMonitorPage /> },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
])
