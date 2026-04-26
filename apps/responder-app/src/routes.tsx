import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@bantayog/shared-ui'
import { LoginPage } from './pages/LoginPage'
import { DispatchListPage } from './pages/DispatchListPage'
import { DispatchDetailPage } from './pages/DispatchDetailPage'
import { ResponderWitnessReportPage } from './pages/ResponderWitnessReportPage'
import { SosPage } from './pages/SosPage'
import { BackupRequestPage } from './pages/BackupRequestPage'

const router = createBrowserRouter([
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
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
