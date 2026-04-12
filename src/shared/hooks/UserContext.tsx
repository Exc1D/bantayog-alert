/**
 * UserContext
 *
 * Provides authenticated user profile data (municipality, role) to the app.
 * Reads from Firestore `users/{uid}` for profile data beyond Firebase Auth.
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import { getDocument } from '@/shared/services/firestore.service'
import type { UserRole } from '@/shared/types/auth.types'

interface UserProfile {
  municipality?: string
  role?: UserRole
}

interface UserContextValue {
  municipality: string | undefined
  role: UserRole | undefined
  isLoading: boolean
}

const UserContext = createContext<UserContextValue>({
  municipality: undefined,
  role: undefined,
  isLoading: true,
})

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setProfile({})
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function loadProfile() {
      try {
        const doc = await getDocument<{ municipality?: string; role?: UserRole }>(
          'users',
          user.uid
        )
        if (!cancelled) {
          setProfile({
            municipality: doc?.municipality,
            role: doc?.role,
          })
        }
      } catch {
        // Auth user but no Firestore profile — treat as citizen with no municipality filter
        if (!cancelled) setProfile({})
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    loadProfile()
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <UserContext.Provider
      value={{
        municipality: profile.municipality,
        role: profile.role,
        isLoading,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

/**
 * Access authenticated user's municipality and role from context.
 * Falls back to undefined for anonymous/unauthenticated users.
 */
export function useUserContext(): UserContextValue {
  return useContext(UserContext)
}
