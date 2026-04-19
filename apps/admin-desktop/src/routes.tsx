import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from './app/protected-route'
import { LoginPage } from './pages/LoginPage'
import { TriageQueuePage } from './pages/TriageQueuePage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <TriageQueuePage />
      </ProtectedRoute>
    ),
  },
])
