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
import { MessagesPage } from './pages/MessagesPage'
import { MessageThreadPage } from './pages/MessageThreadPage'
import { ProfilePage } from './pages/ProfilePage'
import { ShiftHandoffPage } from './pages/ShiftHandoffPage'
import { DispatchHistoryPage } from './pages/DispatchHistoryPage'
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
            <TabLayout />
          </ProtectedRoute>
        ),
        children: [
          { path: '/', element: <DispatchListPage /> },
          { path: '/map', element: <MapPage /> },
          { path: '/messages', element: <MessagesPage /> },
          { path: '/messages/:reportId', element: <MessageThreadPage /> },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
      {
        element: (
          <ProtectedRoute allowedRoles={['responder']}>
            <Outlet />
          </ProtectedRoute>
        ),
        children: [
          { path: '/dispatches/:dispatchId', element: <DispatchDetailPage /> },
          { path: '/dispatches/:id/witness-report', element: <ResponderWitnessReportPage /> },
          { path: '/dispatches/:id/sos', element: <SosPage /> },
          { path: '/dispatches/:id/backup', element: <BackupRequestPage /> },
          { path: '/handoff', element: <ShiftHandoffPage /> },
          { path: '/history', element: <DispatchHistoryPage /> },
        ],
      },
      { path: '/dispatches', element: <Navigate to="/" replace /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
