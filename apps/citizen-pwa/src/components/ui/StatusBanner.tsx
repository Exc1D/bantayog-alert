import React from 'react'

interface StatusBannerProps {
  variant: 'success' | 'queued' | 'failed'
  icon: React.ReactNode
  children: React.ReactNode
}

export function StatusBanner({ variant, icon, children }: StatusBannerProps) {
  return (
    <div className={`status-banner status-banner--${variant}`}>
      <div className="status-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="status-text">{children}</div>
    </div>
  )
}
