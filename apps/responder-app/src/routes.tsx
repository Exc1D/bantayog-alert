import { useEffect } from 'react'
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  useNavigate,
} from 'react-router-dom'
import { ProtectedRoute } from '@bantayog/shared-ui'
import { Shell } from './components/Shell'
import { LoginPage } from './pages/LoginPage'
import { DispatchListPage } from './pages/DispatchListPage'
import { DispatchDetailPage } from './pages/DispatchDetailPage'
import { MapPage } from './pages/MapPage'
import { FeedPage } from './pages/FeedPage'
import { AlertsPage } from './pages/AlertsPage'
import { ProfilePage } from './pages/ProfilePage'

import { DispatchHistoryPage } from './pages/DispatchHistoryPage'
import { ResponderWitnessReportPage } from './pages/ResponderWitnessReportPage'
import { SosPage } from './pages/SosPage'
import { BackupRequestPage } from './pages/BackupRequestPage'
import { TotpGuard } from './pages/TotpGuard'
import { TotpEnrollmentPage } from './pages/TotpEnrollmentPage'
import { subscribeForegroundPush, subscribeNotificationTap } from './services/push-client'

function NotificationRouter() {
  const navigate = useNavigate()

  useEffect(() => {
    const unsubscribeTap = subscribeNotificationTap((dispatchId) => {
      void navigate(`/dispatches/${dispatchId}`)
    })
    const unsubscribeForeground = subscribeForegroundPush((payload) => {
      if (import.meta.env.DEV) {
        const type = (payload as Record<string, unknown> | undefined)?.type
        console.warn('[push] foreground notification received', type)
      }
    })
    return () => {
      unsubscribeTap()
      unsubscribeForeground()
    }
  }, [navigate])

  return null
}

function TabLayout() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  )
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
        element: (
          <ProtectedRoute allowedRoles={['responder']}>
            <Outlet />
          </ProtectedRoute>
        ),
        children: [
          { path: '/totp-enroll', element: <TotpEnrollmentPage /> },
          {
            element: (
              <TotpGuard>
                <TabLayout />
              </TotpGuard>
            ),
            children: [
              { path: '/', element: <DispatchListPage /> },
              { path: '/map', element: <MapPage /> },
              { path: '/feed', element: <FeedPage /> },
              { path: '/alerts', element: <AlertsPage /> },
              { path: '/profile', element: <ProfilePage /> },
            ],
          },
          {
            element: (
              <TotpGuard>
                <Outlet />
              </TotpGuard>
            ),
            children: [
              { path: '/dispatches/:dispatchId', element: <DispatchDetailPage /> },
              {
                path: '/dispatches/:dispatchId/witness-report',
                element: <ResponderWitnessReportPage />,
              },
              { path: '/dispatches/:dispatchId/sos', element: <SosPage /> },
              { path: '/dispatches/:dispatchId/backup', element: <BackupRequestPage /> },

              { path: '/history', element: <DispatchHistoryPage /> },
            ],
          },
        ],
      },
      { path: '/dispatches', element: <Navigate to="/" replace /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
