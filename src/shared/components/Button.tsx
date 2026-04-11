import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  children: React.ReactNode
}

export function Button({
  variant = 'primary',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'min-h-[44px] px-4 py-3 rounded-lg font-medium transition-colors'

  const variantStyles = {
    primary: 'bg-primary-blue text-white hover:bg-blue-800 disabled:bg-gray-400',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:bg-gray-100',
    danger: 'bg-primary-red text-white hover:bg-red-700 disabled:bg-gray-400',
  }

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${className} flex items-center justify-center gap-2`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
