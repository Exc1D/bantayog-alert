import { RouterProvider } from 'react-router-dom'
import { AuthProvider, useAuth } from '@bantayog/shared-ui'
import { auth } from './app/firebase'
import { router } from './routes'
import { VersionGate } from './components/VersionGate'
import { PrivacyNoticeModal } from './components/PrivacyNoticeModal'
import { DevAuthBypass } from './components/DevAuthBypass'

function PrivacyGate() {
  const { user } = useAuth()
  if (!user) return null
  return <PrivacyNoticeModal uid={user.uid} />
}

export default function App() {
  return (
    <VersionGate>
      <AuthProvider auth={auth}>
        <DevAuthBypass />
        <PrivacyGate />
        <RouterProvider router={router} />
      </AuthProvider>
    </VersionGate>
  )
}
