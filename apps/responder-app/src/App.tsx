import './App.module.css'
import { useEffect } from 'react'
import { AppRouter } from './routes'
import { useAuth } from './app/auth-provider'
import { useRegisterFcmToken } from './hooks/useRegisterFcmToken'

function FcmSetup() {
  const { user } = useAuth()
  const { register } = useRegisterFcmToken({
    responderDocPath: user ? `responders/${user.uid}` : '',
  })

  useEffect(() => {
    if (!user) return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .then(() => register())
      .catch((err: unknown) => {
        console.warn('SW registration failed:', err)
      })
  }, [user, register])

  return null
}

export default function App() {
  return (
    <>
      <FcmSetup />
      <AppRouter />
    </>
  )
}
