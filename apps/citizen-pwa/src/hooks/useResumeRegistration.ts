import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, hasFirebaseConfig } from '../services/firebase.js'

const RESUME_QUERY = 'resume=registration'
const SKIP_PATHS = new Set(['/register', '/goodbye'])

/**
 * Detects "phone-linked auth user without /users/{uid} doc" — the orphaned
 * state caused by a successful phone link (and possibly profile update) that
 * never completed `registerCitizen`. Routes the user back to /register so
 * they can finish the consent step instead of being stranded.
 */
export function useResumeRegistration(): void {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()

  useEffect(() => {
    if (!hasFirebaseConfig()) return
    if (SKIP_PATHS.has(pathname)) return
    if (search.includes(RESUME_QUERY)) return

    let active = true
    let latestUid: string | null = null
    const unsubscribe = onAuthStateChanged(auth(), (user) => {
      if (!active) return
      if (!user || user.isAnonymous) return
      if (!user.phoneNumber) return

      latestUid = user.uid
      const currentUid = user.uid

      // User completed phone verification at some point. Check if the citizen
      // document exists; if not, registration was interrupted.
      void getDoc(doc(db(), 'users', currentUid))
        .then((snap) => {
          if (!active || currentUid !== latestUid) return
          if (snap.exists()) return
          void navigate(`/register?${RESUME_QUERY}`, { replace: true })
        })
        .catch((err: unknown) => {
          if (currentUid !== latestUid) return
          console.warn('[useResumeRegistration] users/{uid} read failed:', err)
        })
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [navigate, pathname, search])
}
