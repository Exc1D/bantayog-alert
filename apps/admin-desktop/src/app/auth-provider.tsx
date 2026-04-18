import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth'
import { auth } from './firebase'

export interface AdminClaims {
  role?: string
  municipalityId?: string
  active?: boolean
}

interface AuthState {
  user: User | null
  claims: AdminClaims | null
  loading: boolean
  signOut: () => Promise<void>
  refreshClaims: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [claims, setClaims] = useState<AdminClaims | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshClaims = async () => {
    if (!auth.currentUser) {
      setClaims(null)
      return
    }
    const tok = await auth.currentUser.getIdTokenResult(true)
    setClaims({
      role: tok.claims.role as string | undefined,
      municipalityId: tok.claims.municipalityId as string | undefined,
      active: tok.claims.active === true,
    } as AdminClaims)
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (u) {
        void u.getIdTokenResult().then((tok) => {
          setClaims({
            role: tok.claims.role as string | undefined,
            municipalityId: tok.claims.municipalityId as string | undefined,
            active: tok.claims.active === true,
          } as AdminClaims)
          setLoading(false)
        })
      } else {
        setClaims(null)
        setLoading(false)
      }
    })
    return unsubscribe
  }, [])

  return (
    <Ctx.Provider value={{ user, claims, loading, signOut: () => fbSignOut(auth), refreshClaims }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}
