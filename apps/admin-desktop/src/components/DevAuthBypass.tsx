import { useEffect, useRef } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/app/firebase'

const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true'
const DEV_EMAIL = 'superadmin@test.local'
const DEV_PASSWORD = 'test123456'

export function DevAuthBypass() {
  const attempted = useRef(false)

  useEffect(() => {
    if (!useEmulator || attempted.current) return
    attempted.current = true

    if (auth.currentUser) return

    signInWithEmailAndPassword(auth, DEV_EMAIL, DEV_PASSWORD).catch((err: unknown) => {
      console.warn('[DevAuthBypass] auto-login failed:', err)
    })
  }, [])

  return null
}
