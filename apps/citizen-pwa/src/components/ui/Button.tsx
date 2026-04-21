import React from 'react'

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
  ...props
}: ButtonProps) {
  const baseStyles =
    'px-4 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#001e40]'
  const variantStyles = {
    primary: 'bg-[#001e40] text-white hover:bg-[#032038]',
    secondary: 'bg-[#f5f7fa] text-[#001e40] hover:bg-[#e5e7eb]',
    amber: 'bg-[#b45309] text-white hover:bg-[#92400e]',
    red: 'bg-[#b91c1c] text-white hover:bg-[#991b1b]',
  }

  return (
    <button
      type="button"
      className={`${baseStyles} ${variantStyles[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
