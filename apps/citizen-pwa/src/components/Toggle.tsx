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

  const trackClasses = [
    'relative w-10 h-6 rounded-full border-none p-0 flex-shrink-0 outline-offset-2',
    checked ? 'bg-[#0f9488]' : 'bg-[#ccc]',
    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    reducedMotion ? '' : 'transition-colors duration-200',
  ].join(' ')

  const thumbClasses = [
    'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm',
    checked ? 'translate-x-4' : 'translate-x-0',
    reducedMotion ? '' : 'transition-transform duration-200',
  ].join(' ')

  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
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
        className={trackClasses}
      >
        <span className={thumbClasses} />
      </button>
    </div>
  )
}
