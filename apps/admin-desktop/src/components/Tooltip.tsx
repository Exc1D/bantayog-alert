import { useState, useId, type ReactNode } from 'react'

interface Props {
  content: string
  children: ReactNode
}

export function Tooltip({ content, children }: Props) {
  const [visible, setVisible] = useState(false)
  const tooltipId = useId()

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => {
        setVisible(true)
      }}
      onMouseLeave={() => {
        setVisible(false)
      }}
      onFocus={() => {
        setVisible(true)
      }}
      onBlur={() => {
        setVisible(false)
      }}
    >
      <span aria-describedby={visible ? tooltipId : undefined}>{children}</span>
      {visible && (
        <div
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded border border-white/10 bg-[var(--color-surface-elevated)] px-2 py-1 text-xs text-[var(--color-text-secondary)] shadow-xl"
        >
          {content}
          <span
            className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[var(--color-surface-elevated)]"
            aria-hidden="true"
          />
        </div>
      )}
    </span>
  )
}
