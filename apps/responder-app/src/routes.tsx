import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@bantayog/shared-ui'
import { LoginPage } from './pages/LoginPage'
import { DispatchListPage } from './pages/DispatchListPage'
import { DispatchDetailPage } from './pages/DispatchDetailPage'

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
  { path: '/dispatches', element: <Navigate to="/" replace /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
