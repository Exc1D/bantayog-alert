import React from 'react'

import { hapticMedium } from '../../lib/haptics'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'amber' | 'red'
  fullWidth?: boolean
  disabled?: boolean
  children: React.ReactNode
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  disabled = false,
  children,
  className = '',
  onClick,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`btn btn--${variant}${fullWidth ? ' btn--full' : ''}${className ? ' ' + className : ''}`}
      disabled={disabled}
      onClick={(e) => {
        hapticMedium()
        onClick?.(e)
      }}
      {...props}
    >
      {children}
    </button>
  )
}
