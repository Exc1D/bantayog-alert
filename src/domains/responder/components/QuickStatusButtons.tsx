/**
 * QuickStatusButtons Component
 *
 * Renders four status-update buttons for a single dispatch.
 * Calls useQuickStatus internally — self-contained, no props for the hook.
 * Buttons are disabled when a global update is in progress or this dispatch
 * has a pending status (prevents double-clicks for this specific dispatch).
 *
 * @param dispatchId - the dispatch this button group controls
 */
import { useQuickStatus } from '../hooks/useQuickStatus'
import type { QuickStatus } from '../types'

interface QuickStatusButtonsProps {
  dispatchId: string
}

const BUTTON_CONFIG: Array<{ status: QuickStatus; label: string; colorClass: string; hoverClass: string }> = [
  { status: 'en_route',         label: 'En Route',           colorClass: 'bg-blue-500',   hoverClass: 'hover:bg-blue-600' },
  { status: 'on_scene',        label: 'On Scene',          colorClass: 'bg-green-500',  hoverClass: 'hover:bg-green-600' },
  { status: 'needs_assistance', label: 'Request Assistance', colorClass: 'bg-orange-500', hoverClass: 'hover:bg-orange-600' },
  { status: 'completed',       label: 'Complete',          colorClass: 'bg-gray-500',    hoverClass: 'hover:bg-gray-600' },
]

export function QuickStatusButtons({ dispatchId }: QuickStatusButtonsProps) {
  const { updateStatus, isUpdating, pendingStatus } = useQuickStatus()

  const isPending = pendingStatus.has(dispatchId)
  const isDisabled = isUpdating || isPending

  return (
    <div className="mt-3 flex gap-2">
      {BUTTON_CONFIG.map(({ status, label, colorClass, hoverClass }) => (
        <button
          key={status}
          onClick={(e) => {
            e.stopPropagation()
            updateStatus(dispatchId, status)
          }}
          disabled={isDisabled}
          className={`px-3 py-1 text-sm ${colorClass} text-white rounded ${hoverClass} disabled:opacity-50`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}