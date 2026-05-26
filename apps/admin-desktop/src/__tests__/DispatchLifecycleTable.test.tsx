import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DispatchLifecycleTable } from '../components/DispatchLifecycleTable'
import type { DispatchLifecycleRow } from '../hooks/useDispatchLifecycle'
import { generateIdempotencyKey } from '../utils/generateIdempotencyKey'

function makeRow(overrides: Partial<DispatchLifecycleRow> = {}): DispatchLifecycleRow {
  return {
    dispatchId: overrides.dispatchId ?? generateIdempotencyKey(),
    reportId: overrides.reportId ?? 'rep-12345-abcde',
    status: overrides.status ?? 'pending',
    responderName: overrides.responderName ?? 'Juan Dela Cruz',
    responderAgency: overrides.responderAgency ?? 'BFP',
    dispatchedAt: overrides.dispatchedAt ?? Date.now(),
    deadlineAt: overrides.deadlineAt ?? Date.now() + 3600000,
    escalationCount: overrides.escalationCount ?? 0,
    fcmResult: overrides.fcmResult ?? null,
    fcmWarnings: overrides.fcmWarnings ?? null,
    timeline: overrides.timeline ?? [],
  }
}

describe('DispatchLifecycleTable', () => {
  it('renders "No active dispatches" when rows is empty', () => {
    render(<DispatchLifecycleTable rows={[]} />)
    expect(screen.getByText('No active dispatches')).toBeInTheDocument()
  })

  it('renders header row with report, responder, status, fcm, escalation columns', () => {
    const rows: DispatchLifecycleRow[] = [makeRow()]
    render(<DispatchLifecycleTable rows={rows} />)

    expect(screen.getByText('Report')).toBeInTheDocument()
    expect(screen.getByText('Responder')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    // FCM appears twice: column header + tooltip label
    expect(screen.getAllByText('FCM').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Escalations')).toBeInTheDocument()
  })

  it('shows reportId first 8 characters in Report column', () => {
    const rows: DispatchLifecycleRow[] = [makeRow({ reportId: 'rep-12345-abcde' })]
    render(<DispatchLifecycleTable rows={rows} />)
    expect(screen.getByText('rep-1234')).toBeInTheDocument()
  })

  it.each([
    ['pending', 'Pending'],
    ['accepted', 'Accepted'],
    ['declined', 'Declined'],
    ['needs_admin', 'Needs Admin'],
  ] as const)('renders %s badge with inline dark styles', (status, label) => {
    const rows: DispatchLifecycleRow[] = [makeRow({ status })]
    render(<DispatchLifecycleTable rows={rows} />)
    const badge = screen.getByText(label)
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute('style')
  })

  it('renders FcmStatusIcon in the FCM column', () => {
    const rows: DispatchLifecycleRow[] = [makeRow({ fcmResult: 'sent' })]
    render(<DispatchLifecycleTable rows={rows} />)
    const icon = screen.getByLabelText('FCM delivered to device')
    expect(icon).toBeInTheDocument()
  })

  it('renders escalation count as a number', () => {
    const rows: DispatchLifecycleRow[] = [makeRow({ escalationCount: 3 })]
    render(<DispatchLifecycleTable rows={rows} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders ChevronRight by default and expands to show DispatchTimeline on click', async () => {
    const rows: DispatchLifecycleRow[] = [
      makeRow({
        timeline: [{ id: 'e1', type: 'notification_attempted', dispatchId: 'd1', at: Date.now() }],
      }),
    ]
    render(<DispatchLifecycleTable rows={rows} />)

    const chevron = screen.getByRole('button', { name: /expand row/i })
    expect(chevron).toBeInTheDocument()

    await userEvent.click(chevron)

    expect(screen.getByText('FCM Sent')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /collapse row/i })).toBeInTheDocument()
  })

  it('displays responder name and agency', () => {
    const rows: DispatchLifecycleRow[] = [
      makeRow({ responderName: 'Maria Santos', responderAgency: 'PNP' }),
    ]
    render(<DispatchLifecycleTable rows={rows} />)
    expect(screen.getByText('Maria Santos')).toBeInTheDocument()
    expect(screen.getByText('PNP')).toBeInTheDocument()
  })

  it('uses List for virtualization', () => {
    const rows: DispatchLifecycleRow[] = [makeRow(), makeRow(), makeRow()]
    render(<DispatchLifecycleTable rows={rows} />)

    const list = screen.getByRole('list')
    expect(list).toBeInTheDocument()
  })

  it('caps list height at 600px for many rows', () => {
    const manyRows = Array.from({ length: 50 }, () => makeRow())
    render(<DispatchLifecycleTable rows={manyRows} />)

    const list = screen.getByRole('list')
    expect(list).toHaveStyle({ height: '600px' })
  })
})
