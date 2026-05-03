import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

export function ConfirmModal() {
  const { confirmModalOpen, confirmModalConfig, closeConfirmModal } = useUIStore()
  if (!confirmModalOpen || !confirmModalConfig) return null
  const {
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
    variant = 'primary',
  } = confirmModalConfig
  const handleConfirm = () => {
    onConfirm()
    closeConfirmModal()
  }
  const handleCancel = () => {
    onCancel?.()
    closeConfirmModal()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={handleCancel}
        role="presentation"
      />
      <div className="relative bg-white border border-border rounded-xl max-w-[560px] w-full mx-4 animate-fade-in-up shadow-lg">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <button
            onClick={handleCancel}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 text-sm text-foreground">{message}</div>
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-md border border-border text-sm text-foreground hover:bg-muted transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-all',
              variant === 'danger'
                ? 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
                : 'bg-accent text-white hover:bg-accent-hover',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
