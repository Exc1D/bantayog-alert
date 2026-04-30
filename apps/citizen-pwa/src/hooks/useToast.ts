import { useState, useCallback, useRef, useEffect } from 'react'

type ToastType = 'info' | 'success' | 'error'

interface ToastState {
  show: boolean
  message: string
  type: ToastType
}

export function useToast() {
  const [state, setState] = useState<ToastState>({ show: false, message: '', type: 'info' })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setState({ show: true, message, type })
    timerRef.current = setTimeout(() => {
      setState((s) => ({ ...s, show: false }))
      timerRef.current = null
    }, 3000)
  }, [])

  return { ...state, toast }
}

export type { ToastType }
