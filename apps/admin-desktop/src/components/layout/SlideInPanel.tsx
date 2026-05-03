import { X } from 'lucide-react'

interface SlideInPanelProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: number
}

export function SlideInPanel({ open, onClose, title, children, width = 480 }: SlideInPanelProps) {
  if (!open) return null

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 bg-black/20 z-[100] animate-fade-in cursor-default"
        onClick={onClose}
        aria-label="Close panel"
      />
      <div
        className="fixed right-0 top-[56px] bottom-0 z-[100] bg-white border-l border-border shadow-xl overflow-y-auto animate-slide-in-right"
        style={{ width }}
      >
        <div className="sticky top-0 bg-muted border-b border-border p-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </>
  )
}
