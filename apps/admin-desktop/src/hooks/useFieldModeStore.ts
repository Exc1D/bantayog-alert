import { useState, useEffect, useCallback, useRef } from 'react'
import { doc, onSnapshot, getFirestore } from 'firebase/firestore'
import { httpsCallable, getFunctions } from 'firebase/functions'

interface FieldModeState {
  isActive: boolean
  expiresAt: number | null
  enter: () => Promise<void>
  exit: () => Promise<void>
}

export function useFieldModeStore(uid: string): FieldModeState {
  const [isActive, setIsActive] = useState(false)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const exitFnRef = useRef<(() => Promise<void>) | null>(null)

  useEffect(() => {
    if (!uid) {
      // Defer state reset to avoid react-hooks/set-state-in-effect
      const id = setTimeout(() => {
        setIsActive(false)
        setExpiresAt(null)
      }, 0)
      return () => {
        clearTimeout(id)
      }
    }
    const ref = doc(getFirestore(), 'field_mode_sessions', uid)
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        const isActiveVal = data.isActive
        setIsActive(typeof isActiveVal === 'boolean' ? isActiveVal : false)
        const expiresAtVal = data.expiresAt
        setExpiresAt(typeof expiresAtVal === 'number' ? expiresAtVal : null)
      } else {
        setIsActive(false)
        setExpiresAt(null)
      }
    })
    return unsub
  }, [uid])

  const exit = useCallback(async () => {
    const fn = httpsCallable(getFunctions(), 'exitFieldMode')
    await fn({})
  }, [])

  useEffect(() => {
    exitFnRef.current = exit
  }, [exit])

  // Check expiry every 60 seconds; exit if expired
  useEffect(() => {
    if (!isActive || expiresAt === null) return
    let exitTriggered = false
    const id = setInterval(() => {
      if (!exitTriggered && Date.now() >= expiresAt) {
        exitTriggered = true
        clearInterval(id)
        void exitFnRef.current?.()
      }
    }, 60_000)
    return () => {
      clearInterval(id)
    }
  }, [isActive, expiresAt])

  const enter = useCallback(async () => {
    const fn = httpsCallable(getFunctions(), 'enterFieldMode')
    await fn({})
  }, [])

  return { isActive, expiresAt, enter, exit }
}
