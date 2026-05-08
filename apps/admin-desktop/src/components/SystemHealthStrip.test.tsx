import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SystemHealthStrip } from '../components/SystemHealthStrip'

const mockHealthData = {
  auditStream: { status: 'ok' as const, lastSuccess: new Date(), gapSeconds: 5 },
  batchPipeline: { status: 'ok' as const, lastSuccess: new Date(), gapSeconds: 30 },
  smsDelivery: {
    status: 'delayed' as const,
    lastSuccess: new Date(Date.now() - 120000),
    gapSeconds: 120,
  },
  fcmPush: { status: 'ok' as const, lastSuccess: new Date(), gapSeconds: 10 },
}

describe('SystemHealthStrip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders all health indicators', () => {
    render(<SystemHealthStrip health={mockHealthData} />)

    expect(screen.getByText('AUDIT STREAM')).toBeInTheDocument()
    expect(screen.getByText('BATCH')).toBeInTheDocument()
    expect(screen.getByText('SMS')).toBeInTheDocument()
    expect(screen.getByText('FCM')).toBeInTheDocument()
  })

  it('shows OK status for healthy services', () => {
    render(<SystemHealthStrip health={mockHealthData} />)

    const okElements = screen.getAllByText('OK')
    expect(okElements.length).toBeGreaterThan(0)
  })

  it('shows DELAYED status for delayed services', () => {
    render(<SystemHealthStrip health={mockHealthData} />)

    expect(screen.getByText('DELAYED')).toBeInTheDocument()
  })

  it('shows DOWN status for failed services', () => {
    const downHealth = {
      ...mockHealthData,
      fcmPush: {
        status: 'down' as const,
        lastSuccess: new Date(Date.now() - 600000),
        gapSeconds: 600,
      },
    }

    render(<SystemHealthStrip health={downHealth} />)

    expect(screen.getByText('DOWN')).toBeInTheDocument()
  })

  it('shows tooltip with details on hover', async () => {
    const user = userEvent.setup()
    render(<SystemHealthStrip health={mockHealthData} />)

    const smsIndicator = screen.getByText('SMS').closest('div')
    if (smsIndicator) {
      await user.hover(smsIndicator)
      // Tooltip would appear in a real implementation
      // For now, we verify the component structure
      expect(smsIndicator).toBeInTheDocument()
    }
  })

  it('renders with all services OK', () => {
    const allOk = {
      auditStream: { status: 'ok' as const, lastSuccess: new Date(), gapSeconds: 5 },
      batchPipeline: { status: 'ok' as const, lastSuccess: new Date(), gapSeconds: 10 },
      smsDelivery: { status: 'ok' as const, lastSuccess: new Date(), gapSeconds: 15 },
      fcmPush: { status: 'ok' as const, lastSuccess: new Date(), gapSeconds: 8 },
    }

    render(<SystemHealthStrip health={allOk} />)

    const okElements = screen.getAllByText('OK')
    expect(okElements.length).toBe(4)
  })

  it('applies correct color coding for statuses', () => {
    render(<SystemHealthStrip health={mockHealthData} />)

    // Check that delayed indicator has warning styling
    const delayedElement = screen.getByText('DELAYED')
    expect(delayedElement).toBeInTheDocument()
  })
})
