/**
 * useAuth Hook
 *
 * Custom React hook for Firebase Authentication.
 * Provides authentication state and sign-in/sign-out functions.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, loading, signIn, signOut } = useAuth();
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (!user) return <button onClick={() => signIn('email', 'pass')}>Sign In</button>;
 *
 *   return <div>Welcome, {user.email}</div>;
 * }
 * ```
 */

import { useEffect, useState } from 'react'
import {
  User,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { auth } from '@/app/firebase/config'

interface AuthState {
  user: User | null
  loading: boolean
}

interface UseAuthReturn extends AuthState {
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
  })

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState({ user, loading: false })
    })

    return unsubscribe
  }, [])

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
  }

  return {
    ...state,
    signIn,
    signOut,
  }
}
