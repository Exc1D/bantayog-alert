import { useReducedMotion } from '../hooks/useReducedMotion'

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  const reducedMotion = useReducedMotion()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (!disabled) onChange(!checked)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} role="group" aria-label={label}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onChange(!checked)
        }}
        onKeyDown={handleKeyDown}
        style={{
          position: 'relative',
          width: 40,
          height: 24,
          borderRadius: 12,
          border: 'none',
          padding: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: checked ? '#f26522' : '#ccc',
          transition: reducedMotion ? 'none' : 'background 200ms ease',
          outlineOffset: 2,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            transition: reducedMotion ? 'none' : 'left 200ms ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </button>
    </div>
  )
}
