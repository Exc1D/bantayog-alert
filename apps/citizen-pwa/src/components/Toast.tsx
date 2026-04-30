import { useReducedMotion } from '../hooks/useReducedMotion'
import type { ToastType } from '../hooks/useToast'

const BG_MAP: Record<ToastType, string> = {
  success: '#1b5e20',
  error: '#b71c1c',
  info: '#001e40',
}

export function Toast({
  show,
  message,
  type,
}: {
  show: boolean
  message: string
  type: ToastType
}) {
  const reducedMotion = useReducedMotion()

  if (!show) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 96,
        left: 16,
        right: 16,
        zIndex: 60,
        background: BG_MAP[type],
        color: '#fff',
        padding: '12px 16px',
        borderRadius: 10,
        fontSize: '0.875rem',
        fontWeight: 600,
        textAlign: 'center',
        animation: reducedMotion ? 'none' : 'slideUp 300ms ease-out',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
    >
      {message}
      <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  )
}
