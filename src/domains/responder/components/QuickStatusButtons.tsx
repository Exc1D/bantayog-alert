/**
 * QuickStatusButtons Component
 *
 * Renders four status-update buttons for a single dispatch.
 * Accepts shared quickStatus controller (from parent calling useQuickStatus once)
 * so isUpdating/pendingStatus coordinate globally across all button groups.
 * Buttons are disabled when a global update is in progress or this dispatch
 * has a pending status (prevents double-clicks for this specific dispatch).
 *
 * @param dispatchId - the dispatch this button group controls
 * @param quickStatus - shared status controller from parent useQuickStatus call
 */
import type { QuickStatus } from '../types'

interface QuickStatusController {
  updateStatus: (dispatchId: string, status: QuickStatus) => Promise<void>
  isUpdating: boolean
  pendingStatus: Map<string, QuickStatus>
}

interface QuickStatusButtonsProps {
  dispatchId: string
  quickStatus: QuickStatusController
}

const BUTTON_CONFIG: Array<{ status: QuickStatus; label: string; colorClass: string; hoverClass: string }> = [
  { status: 'en_route',         label: 'En Route',           colorClass: 'bg-blue-500',   hoverClass: 'hover:bg-blue-600' },
  { status: 'on_scene',        label: 'On Scene',          colorClass: 'bg-green-500',  hoverClass: 'hover:bg-green-600' },
  { status: 'needs_assistance', label: 'Request Assistance', colorClass: 'bg-orange-500', hoverClass: 'hover:bg-orange-600' },
  { status: 'completed',       label: 'Complete',          colorClass: 'bg-gray-500',    hoverClass: 'hover:bg-gray-600' },
]

export function QuickStatusButtons({ dispatchId, quickStatus }: QuickStatusButtonsProps) {
  const { updateStatus, isUpdating, pendingStatus } = quickStatus

  // Defensive: guard against invalid/whitespace dispatchId
  const normalizedId = typeof dispatchId === 'string' && dispatchId.trim() !== '' ? dispatchId.trim() : null
  const isPending = normalizedId ? pendingStatus.has(normalizedId) : false
  const isDisabled = !normalizedId || isUpdating || isPending

  return (
    <div className="mt-3 flex gap-2">
      {BUTTON_CONFIG.map(({ status, label, colorClass, hoverClass }) => (
        <button
          key={status}
          onClick={(e) => {
            if (!normalizedId) return
            e.stopPropagation()
            void updateStatus(normalizedId, status)
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