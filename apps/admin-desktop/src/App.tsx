import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@bantayog/shared-ui'
import { auth } from './app/firebase'
import { router } from './routes'
import { SkipLink } from './components/SkipLink'
import { LiveAnnouncer } from './components/LiveAnnouncer'

export default function App() {
  return (
    <>
      <SkipLink />
      <LiveAnnouncer />
      <AuthProvider auth={auth}>
        <RouterProvider router={router} />
      </AuthProvider>
    </>
  )
}
