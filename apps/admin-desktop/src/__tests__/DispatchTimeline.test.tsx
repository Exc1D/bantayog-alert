import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DispatchTimeline } from '../components/DispatchTimeline'
import type { DispatchEvent } from '../hooks/useDispatchLifecycle'

function eventStub(
  overrides: Partial<DispatchEvent> & { type: string; at: number },
): DispatchEvent {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    dispatchId: overrides.dispatchId ?? 'd1',
    ...overrides,
  }
}

describe('DispatchTimeline', () => {
  it('renders empty state when events array is empty', () => {
    render(<DispatchTimeline events={[]} />)
    expect(screen.getByText('No events recorded')).toBeInTheDocument()
  })

  it('sorts events chronologically oldest first by at timestamp', () => {
    const events = [
      eventStub({ type: 'notification_attempted', at: 3000 }),
      eventStub({ type: 'notification_delivered', at: 1000 }),
      eventStub({ type: 'deadline_exceeded', at: 2000 }),
    ]
    render(<DispatchTimeline events={events} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('Responder Notified')
    expect(items[1]).toHaveTextContent('Deadline Passed')
    expect(items[2]).toHaveTextContent('FCM Sent')
  })

  it.each([
    ['notification_attempted', 'FCM Sent'],
    ['notification_delivered', 'Responder Notified'],
    ['deadline_exceeded', 'Deadline Passed'],
    ['escalation_attempted', 'Re-assigned'],
    ['lease_stolen', 'Lease Override'],
  ] as const)('maps %s to "%s" label', (type, label) => {
    const events = [eventStub({ type, at: 1000 })]
    render(<DispatchTimeline events={events} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('renders raw type string for unknown event types', () => {
    const events = [eventStub({ type: 'unknown_type_here', at: 1000 })]
    render(<DispatchTimeline events={events} />)
    expect(screen.getByText('unknown_type_here')).toBeInTheDocument()
  })

  it('formats event time as HH:MM:SS', () => {
    const date = new Date('2024-06-15T09:05:03')
    const events = [eventStub({ type: 'notification_attempted', at: date.getTime() })]
    render(<DispatchTimeline events={events} />)
    expect(screen.getByText('09:05:03')).toBeInTheDocument()
  })
})
