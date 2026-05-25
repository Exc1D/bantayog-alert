import { useEffect, useState } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { ResponderFleetMember } from '../hooks/useResponderFleet'

interface Props {
  isOpen: boolean
  onClose: () => void
  onDispatch: (responderUid: string, forceOverride?: true) => void
  responders: ResponderFleetMember[]
  previouslyNotified: string[]
  isLoading: boolean
}

export function ReDispatchModal({
  isOpen,
  onClose,
  onDispatch,
  responders,
  previouslyNotified,
  isLoading,
}: Props) {
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [showForceDialog, setShowForceDialog] = useState(false)
  const trapRef = useFocusTrap({ isActive: isOpen, onEscape: onClose })

  // Reset modal state when closed
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) {
      setSelectedUid(null)
      setShowForceDialog(false)
    }
  }, [isOpen])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen) return null

  const available = responders.filter((r) => !previouslyNotified.includes(r.uid))

  const suggested = [...available].sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, 3)

  const hasCandidates = suggested.length > 0

  const handleSelect = (uid: string) => {
    setSelectedUid(uid)
  }

  const handleDispatch = () => {
    if (!selectedUid || isLoading) return
    onDispatch(selectedUid, undefined)
  }

  const handleForceClick = () => {
    setShowForceDialog(true)
  }

  const handleConfirmForce = () => {
    if (isLoading) return
    const best = [...responders].sort((a, b) => b.lastSeenAt - a.lastSeenAt)[0]
    if (best) {
      onDispatch(best.uid, true)
    }
  }

  const handleCancelForce = () => {
    setShowForceDialog(false)
  }

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="re-dispatch-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-white/10 bg-[var(--color-surface)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="re-dispatch-title" className="text-lg font-semibold text-white">
            Re-dispatch
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-white/10" aria-label="Close">
            <span className="sr-only">Close</span>×
          </button>
        </div>

        {hasCandidates ? (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-400">Recommended</h3>
            <ul className="space-y-2">
              {suggested.map((r) => (
                <li key={r.uid}>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelect(r.uid)
                    }}
                    className={`w-full rounded border px-4 py-3 text-left transition ${
                      selectedUid === r.uid
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">{r.displayName}</span>
                      <span className="text-xs text-gray-400">{r.onlineStatus}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={handleDispatch}
              disabled={!selectedUid || isLoading}
              className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Dispatching...' : 'Dispatch Selected'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              No new candidates available. All responders have been notified.
            </p>
            {!showForceDialog ? (
              <button
                type="button"
                onClick={handleForceClick}
                disabled={isLoading}
                className="flex items-center gap-2 rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⚡ Force Re-notify
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-300">
                  Force re-notify the most recently active responder?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmForce}
                    disabled={isLoading}
                    className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Force Re-notify
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelForce}
                    className="rounded border border-white/20 px-4 py-2 text-sm text-gray-300 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
