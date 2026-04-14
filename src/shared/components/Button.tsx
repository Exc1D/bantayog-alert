import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline'
  size?: 'md' | 'sm'
  children: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'rounded-lg font-medium transition-colors flex items-center justify-center gap-2'

  const sizeStyles = {
    md: 'min-h-[44px] px-4 py-3',
    sm: 'min-h-[36px] px-3 py-2 text-sm',
  }

  const variantStyles = {
    primary: 'bg-primary-blue text-white hover:bg-blue-800 disabled:bg-gray-400',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:bg-gray-100',
    danger: 'bg-primary-red text-white hover:bg-red-700 disabled:bg-gray-400',
    outline:
      'bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:bg-gray-100',
  }

  return (
    <button
      type="button"
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
