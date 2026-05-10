import { RouterProvider } from 'react-router-dom'
import { AuthProvider, useAuth } from '@bantayog/shared-ui'
import { auth } from './app/firebase'
import { router } from './routes'
import { WindowSyncProvider } from './providers/WindowSyncProvider'
import { ErrorBoundary } from './providers/ErrorBoundary'

function AuthGate() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <WindowSyncProvider>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </WindowSyncProvider>
  )
}

export default function App() {
  return (
    <AuthProvider auth={auth}>
      <AuthGate />
    </AuthProvider>
  )
}
