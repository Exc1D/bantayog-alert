import { useEffect } from 'react'
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  useNavigate,
} from 'react-router-dom'
import { ProtectedRoute } from '@bantayog/shared-ui'
import { LoginPage } from './pages/LoginPage'
import { DispatchListPage } from './pages/DispatchListPage'
import { DispatchDetailPage } from './pages/DispatchDetailPage'
import { ResponderWitnessReportPage } from './pages/ResponderWitnessReportPage'
import { SosPage } from './pages/SosPage'
import { BackupRequestPage } from './pages/BackupRequestPage'
import { subscribeForegroundPush, subscribeNotificationTap } from './services/push-client'

function NotificationRouter() {
  const navigate = useNavigate()

  useEffect(() => {
    const unsubscribeTap = subscribeNotificationTap((dispatchId) => {
      void navigate(`/dispatches/${dispatchId}`)
    })

    const unsubscribeForeground = subscribeForegroundPush((payload) => {
      console.warn('Foreground push received:', payload)
    })

    return () => {
      unsubscribeTap()
      unsubscribeForeground()
    }
  }, [navigate])

  return null
}

function AppLayout() {
  return (
    <>
      <NotificationRouter />
      <Outlet />
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        path: '/',
        element: (
          <ProtectedRoute allowedRoles={['responder']}>
            <DispatchListPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/dispatches/:dispatchId',
        element: (
          <ProtectedRoute allowedRoles={['responder']}>
            <DispatchDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/dispatches/:id/witness-report',
        element: (
          <ProtectedRoute allowedRoles={['responder']}>
            <ResponderWitnessReportPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/dispatches/:id/sos',
        element: (
          <ProtectedRoute allowedRoles={['responder']}>
            <SosPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/dispatches/:id/backup',
        element: (
          <ProtectedRoute allowedRoles={['responder']}>
            <BackupRequestPage />
          </ProtectedRoute>
        ),
      },
      { path: '/dispatches', element: <Navigate to="/" replace /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
