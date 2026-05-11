import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@bantayog/shared-ui'
import DashboardPage from './pages/DashboardPage'
import MapPage from './pages/MapPage'
import MobileGate from './pages/MobileGate'
import { LoginPage } from './pages/LoginPage'
import { WindowSyncProvider } from './providers/WindowSyncProvider'
import { ErrorBoundary } from './providers/ErrorBoundary'

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

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
      { path: '/', element: isMobile ? <MobileGate /> : <Navigate to="/dashboard" replace /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/map', element: <MapPage /> },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
])
