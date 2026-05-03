import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { useEffect } from 'react'

const iconMap = {
  success: <CheckCircle className="w-4 h-4 text-green-600" />,
  error: <AlertCircle className="w-4 h-4 text-red-600" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-600" />,
  info: <Info className="w-4 h-4 text-blue-600" />,
}
const borderMap = {
  success: 'border-l-green-500',
  error: 'border-l-red-500',
  warning: 'border-l-amber-500',
  info: 'border-l-blue-500',
}

export function ToastSystem() {
  const { toasts, removeToast } = useUIStore()
  return (
    <div className="fixed top-[72px] right-4 z-[400] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={() => {
            removeToast(toast.id)
          }}
        />
      ))}
    </div>
  )
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: {
    id: string
    title: string
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }
  onDismiss: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss()
    }, 5000)
    return () => {
      clearTimeout(timer)
    }
  }, [onDismiss])
  return (
    <div
      className={cn(
        'bg-white border border-border border-l-4 rounded-lg p-3 shadow-md animate-slide-in-right flex items-start gap-3',
        borderMap[toast.type],
      )}
    >
      {iconMap[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{toast.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{toast.message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
