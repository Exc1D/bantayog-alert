import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@bantayog/shared-ui'
import { auth } from './app/firebase'
import { router } from './routes'

export default function App() {
  return (
    <AuthProvider auth={auth}>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
