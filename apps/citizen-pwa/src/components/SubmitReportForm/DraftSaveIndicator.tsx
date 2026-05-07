import { useEffect, useState } from 'react'
import { CloudUpload, Check } from 'lucide-react'

type SaveState = 'idle' | 'saving' | 'saved'

interface DraftSaveIndicatorProps {
  saveState: SaveState
}

export function DraftSaveIndicator({ saveState }: DraftSaveIndicatorProps) {
  const [visible, setVisible] = useState(saveState !== 'idle')

  useEffect(() => {
    if (saveState === 'idle') return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true)

    if (saveState !== 'saved') return

    // Auto-hide 3 seconds after "saved" state
    const timer = setTimeout(() => {
      setVisible(false)
    }, 3000)

    return () => {
      clearTimeout(timer)
    }
  }, [saveState])

  if (!visible || saveState === 'idle') return null

  return (
    <div
      role="status"
      aria-label="Draft save status"
      aria-live="polite"
      className="flex items-center gap-1.5 text-xs text-surface-500 motion-safe:transition-opacity"
    >
      {saveState === 'saving' ? (
        <>
          <CloudUpload
            size={13}
            className="text-surface-400 motion-safe:animate-pulse"
            aria-hidden="true"
          />
          <span>Saving draft...</span>
        </>
      ) : (
        <>
          <Check size={13} className="text-success-600" aria-hidden="true" />
          <span className="text-success-600">Draft saved</span>
        </>
      )}
    </div>
  )
}
