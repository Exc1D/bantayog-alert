import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signOut as fbSignOut, type Auth, type User } from 'firebase/auth'

export interface AuthContextValue {
  user: User | null
  claims: Record<string, unknown> | null
  loading: boolean
  signOut: () => Promise<void>
  refreshClaims: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
  auth: Auth
}

export function AuthProvider({ children, auth }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [claims, setClaims] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshClaims = useCallback(async () => {
    const currentUser = auth.currentUser
    if (!currentUser) {
      setClaims(null)
      return
    }
    try {
      const token = await currentUser.getIdTokenResult(true)
      // Guard against stale user (sign-out or account switch during refresh)
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (auth.currentUser?.uid !== currentUser.uid) return
      setClaims(token.claims as Record<string, unknown>)
    } catch (err: unknown) {
      console.error('[AuthProvider] token refresh failed:', err)
      setClaims(null)
    }
  }, [auth])

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
  }, [auth])

  const signOut = useCallback(async () => {
    await fbSignOut(auth)
  }, [auth])

  return (
    <AuthContext.Provider value={{ user, claims, loading, signOut, refreshClaims }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
