import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AuthProvider } from './app/auth-provider'
import { ProtectedRoute } from './app/protected-route'
import { LoginPage } from './pages/LoginPage'
import { DispatchListPage } from './pages/DispatchListPage'

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DispatchListPage />
      </ProtectedRoute>
    ),
  },
  { path: '/dispatches', element: <Navigate to="/" replace /> },
])

export function AppRouter() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
