/**
 * AlertCard Component Tests
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlertCard } from '../AlertCard'
import type { Alert } from '@/shared/types/firestore.types'

const mockAlert: Alert = {
  id: 'alert-1',
  createdAt: Date.now() - 30 * 60 * 1000, // 30 minutes ago
  updatedAt: Date.now(),
  targetAudience: 'all',
  title: 'TYPHOON WARNING',
  message: 'Typhoon approaching Camarines Norte',
  severity: 'warning',
  deliveryMethod: ['push', 'in_app'],
  createdBy: 'admin-123',
}

describe('AlertCard', () => {
  it('renders alert title', () => {
    render(<AlertCard alert={mockAlert} />)
    expect(screen.getByText('TYPHOON WARNING')).toBeInTheDocument()
  })

  it('renders alert message', () => {
    render(<AlertCard alert={mockAlert} />)
    expect(screen.getByText(/typhoon approaching/i)).toBeInTheDocument()
  })

  it('renders relative time', () => {
    render(<AlertCard alert={mockAlert} />)
    // 30 min ago → "30m ago" (shared formatTimeAgo short format)
    expect(screen.getByText('30m ago')).toBeInTheDocument()
  })

  it('shows severity indicator for warning', () => {
    render(<AlertCard alert={mockAlert} />)
    expect(screen.getByText('⚠️')).toBeInTheDocument()
  })

  it('shows severity indicator for emergency', () => {
    render(<AlertCard alert={{ ...mockAlert, severity: 'emergency' }} />)
    expect(screen.getByText('🔴')).toBeInTheDocument()
  })

  it('shows severity indicator for info', () => {
    render(<AlertCard alert={{ ...mockAlert, severity: 'info' }} />)
    expect(screen.getByText('ℹ️')).toBeInTheDocument()
  })
})
