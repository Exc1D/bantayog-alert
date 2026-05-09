import { RouterProvider } from 'react-router-dom'
import { AuthProvider, useAuth } from '@bantayog/shared-ui'
import { auth } from './app/firebase'
import { router } from './routes'

function AuthGate() {
  const { user } = useAuth()
  if (!user) return null
  return <RouterProvider router={router} />
}

export default function App() {
  return (
    <AuthProvider auth={auth}>
      <AuthGate />
    </AuthProvider>
  )
}
