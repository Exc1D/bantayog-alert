import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActivityFeed } from '../components/dashboard/ActivityFeed'
import type { ReportEventWithId } from '../components/dashboard/ActivityFeed'

vi.mock('@/app/firebase', () => ({ db: {} }))

describe('ActivityFeed', () => {
  const mockEvents: ReportEventWithId[] = [
    {
      id: 'event-1',
      reportId: 'report-1',
      municipalityId: 'daet',
      actor: 'admin@test.com',
      actorRole: 'municipal_admin',
      fromStatus: 'new',
      toStatus: 'verified',
      createdAt: Date.now() / 1000,
      correlationId: 'corr-1',
      schemaVersion: 1,
    },
    {
      id: 'event-2',
      reportId: 'report-2',
      municipalityId: 'basud',
      actor: 'superadmin@test.com',
      actorRole: 'provincial_superadmin',
      fromStatus: 'verified',
      toStatus: 'resolved',
      createdAt: Date.now() / 1000,
      correlationId: 'corr-2',
      schemaVersion: 1,
    },
    {
      id: 'event-3',
      reportId: 'report-3',
      municipalityId: 'labo',
      actor: 'system',
      actorRole: 'system',
      fromStatus: 'resolved',
      toStatus: 'closed',
      reason: 'Duplicate report',
      createdAt: Date.now() / 1000,
      correlationId: 'corr-3',
      schemaVersion: 1,
    },
  ]

  it('shows loading state when loading is true', () => {
    render(<ActivityFeed events={[]} loading={true} />)

    expect(screen.getByText(/loading activity feed/i)).toBeInTheDocument()
  })

  it('shows empty state when no events', () => {
    render(<ActivityFeed events={[]} loading={false} />)

    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument()
  })

  it('shows error state when error is provided', () => {
    render(<ActivityFeed events={[]} loading={false} error="Permission denied" />)

    expect(screen.getByText(/failed to load activity feed/i)).toBeInTheDocument()
    expect(screen.getByText(/permission denied/i)).toBeInTheDocument()
  })

  it('renders events correctly', () => {
    const { container } = render(<ActivityFeed events={mockEvents} loading={false} />)

    expect(container.textContent).toContain('admin@test.com')
    expect(container.textContent).toContain('superadmin@test.com')
    expect(container.textContent).toContain('system')
  })

  it('displays verified event with green color', () => {
    const { container } = render(<ActivityFeed events={mockEvents} loading={false} />)

    expect(container.querySelector('.text-green-700')).toBeInTheDocument()
  })

  it('displays resolved event with green color', () => {
    const { container } = render(<ActivityFeed events={mockEvents} loading={false} />)

    expect(container.querySelector('.text-green-700')).toBeInTheDocument()
  })

  it('displays system event with muted color', () => {
    const { container } = render(<ActivityFeed events={mockEvents} loading={false} />)

    expect(container.querySelector('.text-muted-foreground\\/70')).toBeInTheDocument()
  })

  it('limits visible events to maxVisible prop', () => {
    const { container } = render(
      <ActivityFeed events={mockEvents} loading={false} maxVisible={2} />,
    )

    expect(container.textContent).toContain('admin@test.com')
    expect(container.textContent).toContain('superadmin@test.com')
    expect(container.textContent).not.toContain('system')
  })

  it('shows report ID truncated to 8 characters', () => {
    render(<ActivityFeed events={mockEvents} loading={false} />)

    expect(screen.getByText(/#report-1/i)).toBeInTheDocument()
    expect(screen.getByText(/#report-2/i)).toBeInTheDocument()
  })

  it('shows municipality badge when municipalityId exists', () => {
    render(<ActivityFeed events={mockEvents} loading={false} />)

    expect(screen.getByText(/daet/i)).toBeInTheDocument()
    expect(screen.getByText(/basud/i)).toBeInTheDocument()
    expect(screen.getByText(/labo/i)).toBeInTheDocument()
  })

  it('formats timestamps correctly', () => {
    const fixedTimestamp = Date.now() / 1000
    const eventWithFixedTime: ReportEventWithId = {
      ...mockEvents[0]!,
      createdAt: fixedTimestamp,
    }

    render(<ActivityFeed events={[eventWithFixedTime]} loading={false} />)

    const timestamp = new Date(eventWithFixedTime.createdAt * 1000)
    const hours = String(timestamp.getHours()).padStart(2, '0')
    const minutes = String(timestamp.getMinutes()).padStart(2, '0')

    expect(screen.getByText(new RegExp(`${hours}:${minutes}`))).toBeInTheDocument()
  })

  it('displays reason for rejected events', () => {
    const rejectedEvent: ReportEventWithId = {
      id: 'event-4',
      reportId: 'report-4',
      municipalityId: 'daet',
      actor: 'admin@test.com',
      actorRole: 'municipal_admin',
      fromStatus: 'new',
      toStatus: 'rejected',
      reason: 'Duplicate report',
      createdAt: Date.now() / 1000,
      correlationId: 'corr-4',
      schemaVersion: 1,
    }

    render(<ActivityFeed events={[rejectedEvent]} loading={false} />)

    expect(screen.getByText(/rejected report: duplicate report/i)).toBeInTheDocument()
  })

  it('hides reason when not provided', () => {
    const closedEvent: ReportEventWithId = {
      id: 'event-5',
      reportId: 'report-5',
      municipalityId: 'daet',
      actor: 'admin@test.com',
      actorRole: 'municipal_admin',
      fromStatus: 'resolved',
      toStatus: 'closed',
      createdAt: Date.now() / 1000,
      correlationId: 'corr-5',
      schemaVersion: 1,
    }

    render(<ActivityFeed events={[closedEvent]} loading={false} />)

    expect(screen.getByText(/closed report/i)).toBeInTheDocument()
  })
})
