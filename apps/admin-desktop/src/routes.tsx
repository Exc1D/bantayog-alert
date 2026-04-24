import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from '@bantayog/shared-ui'
import { LoginPage } from './pages/LoginPage'
import { TriageQueuePage } from './pages/TriageQueuePage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute
        allowedRoles={['municipal_admin', 'provincial_superadmin']}
        requireActive
        requireMunicipalityIdForRoles={['municipal_admin']}
        unauthorizedFallback={
          <div role="alert">
            You do not have access to this page. Please contact your superadmin.
          </div>
        }
      >
        <TriageQueuePage />
      </ProtectedRoute>
    ),
  },
])
