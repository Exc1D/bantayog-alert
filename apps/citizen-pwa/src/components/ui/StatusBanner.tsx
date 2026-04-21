import React from 'react'

interface StatusBannerProps {
  variant: 'success' | 'queued' | 'failed'
  icon: React.ReactNode
  children: React.ReactNode
}

export function StatusBanner({ variant, icon, children }: StatusBannerProps) {
  const variantStyles = {
    success: 'bg-[#dcfce7] text-[#166534]',
    queued: 'bg-[#fef3c7] text-[#92400e]',
    failed: 'bg-[#fee2e2] text-[#991b1b]',
  }

  return (
    <div className={`flex items-center gap-2.5 p-3.5 rounded-lg ${variantStyles[variant]}`}>
      <div
        className="w-8 h-8 rounded-full bg-current flex items-center justify-center text-white"
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  )
}
