import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecentEventsFeed } from './RecentEventsFeed'
import type { DispatchLifecycleRow } from '../hooks/useDispatchLifecycle'

afterEach(() => {
  vi.useRealTimers()
})

function row(dispatchId: string, timeline: DispatchLifecycleRow['timeline']): DispatchLifecycleRow {
  return {
    dispatchId,
    reportId: 'r1',
    status: 'pending',
    responderName: 'A',
    responderAgency: 'BFP',
    dispatchedAt: 1000,
    deadlineAt: 2000,
    escalationCount: 0,
    fcmResult: null,
    fcmWarnings: null,
    timeline,
  }
}

function event(
  id: string,
  type: string,
  at: number,
  dispatchId = 'd1',
): DispatchLifecycleRow['timeline'][number] {
  return { id, type, dispatchId, at }
}

describe('RecentEventsFeed', () => {
  it('renders events sorted by time descending across rows', () => {
    const rows: DispatchLifecycleRow[] = [
      row('d1', [
        event('e1', 'notification_attempted', 3000),
        event('e2', 'notification_delivered', 2000),
      ]),
      row('d2', [event('e3', 'escalation_attempted', 2500)]),
    ]
    render(<RecentEventsFeed rows={rows} />)
    const list = screen.getByRole('list')
    expect(list).toHaveAttribute('role', 'list')
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('FCM Sent')
    expect(items[1]).toHaveTextContent('Re-assigned')
    expect(items[2]).toHaveTextContent('Responder Notified')
  })

  it('limits to maxEvents prop', () => {
    const timeline = Array.from({ length: 30 }, (_, i) => ({
      id: `e${String(i)}`,
      type: 'notification_attempted' as const,
      dispatchId: 'd1',
      at: i * 1000,
    }))
    const rows: DispatchLifecycleRow[] = [row('d1', timeline)]
    render(<RecentEventsFeed rows={rows} maxEvents={5} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('defaults maxEvents to 20', () => {
    const timeline = Array.from({ length: 25 }, (_, i) => ({
      id: `e${String(i)}`,
      type: 'notification_attempted' as const,
      dispatchId: 'd1',
      at: i * 1000,
    }))
    const rows: DispatchLifecycleRow[] = [row('d1', timeline)]
    render(<RecentEventsFeed rows={rows} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(20)
  })

  it('shows empty state', () => {
    render(<RecentEventsFeed rows={[]} />)
    expect(screen.getByText(/no events recorded/i)).toBeInTheDocument()
  })

  it('falls back to raw event type for unknown types', () => {
    const rows: DispatchLifecycleRow[] = [row('d1', [event('e1', 'some_unknown_type', 1000)])]
    render(<RecentEventsFeed rows={rows} />)
    expect(screen.getByText('some_unknown_type')).toBeInTheDocument()
  })

  describe('formatRelativeTime buckets', () => {
    it('shows "just now" for events < 60s old', () => {
      vi.useFakeTimers()
      vi.setSystemTime(200_000)
      const rows: DispatchLifecycleRow[] = [
        row('d1', [event('e1', 'notification_attempted', 199_500)]),
      ]
      render(<RecentEventsFeed rows={rows} />)
      expect(screen.getByText('just now')).toBeInTheDocument()
    })

    it('shows minutes ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(200_000)
      const rows: DispatchLifecycleRow[] = [
        row('d1', [event('e1', 'notification_attempted', 100_000)]),
      ]
      render(<RecentEventsFeed rows={rows} />)
      expect(screen.getByText('1m ago')).toBeInTheDocument()
    })

    it('shows hours ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(10_000_000)
      const rows: DispatchLifecycleRow[] = [
        row('d1', [event('e1', 'notification_attempted', 5_000_000)]),
      ]
      render(<RecentEventsFeed rows={rows} />)
      expect(screen.getByText('1h ago')).toBeInTheDocument()
    })

    it('shows days ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(200_000_000)
      const rows: DispatchLifecycleRow[] = [
        row('d1', [event('e1', 'notification_attempted', 50_000_000)]),
      ]
      render(<RecentEventsFeed rows={rows} />)
      expect(screen.getByText('1d ago')).toBeInTheDocument()
    })
  })

  describe('visual indicator classes', () => {
    it.each([
      { type: 'notification_attempted', color: 'bg-[var(--color-info)]', shape: 'rounded-full' },
      { type: 'notification_delivered', color: 'bg-[var(--color-success)]', shape: 'rounded-full' },
      { type: 'escalation_attempted', color: 'bg-[var(--color-warning)]', shape: 'clip-triangle' },
      { type: 'deadline_exceeded', color: 'bg-[var(--color-danger)]', shape: 'clip-diamond' },
      { type: 'unknown_fallback', color: 'bg-gray-500', shape: 'rounded-full' },
    ])('uses $color $shape for $type', ({ type, color, shape }) => {
      const { container } = render(
        <RecentEventsFeed rows={[row('d1', [event('e1', type, 1000)])]} />,
      )
      const indicator = container.querySelector('[aria-hidden="true"]')
      expect(indicator).toBeInTheDocument()
      expect(indicator!.className).toContain(color)
      expect(indicator!.className).toContain(shape)
    })
  })
})
