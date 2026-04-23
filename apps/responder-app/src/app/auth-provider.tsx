import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from './firebase'

interface AuthContextValue {
  user: User | null
  claims: Record<string, unknown> | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [claims, setClaims] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (u) {
        const uid = u.uid
        void u
          .getIdTokenResult(true)
          .then((token) => {
            if (!active || auth.currentUser?.uid !== uid) return
            setClaims(token.claims as Record<string, unknown>)
          })
          .catch((err: unknown) => {
            if (!active || auth.currentUser?.uid !== uid) return
            console.error('[AuthProvider] token refresh failed:', err)
            setClaims(null)
          })
          .finally(() => {
            if (!active || auth.currentUser?.uid !== uid) return
            setLoading(false)
          })
      } else {
        setClaims(null)
        setLoading(false)
      }
    })
    return () => {
      active = false
      unsub()
    }
  }, [])

  async function signOut() {
    const { signOut: fbSignOut } = await import('firebase/auth')
    await fbSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, claims, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
