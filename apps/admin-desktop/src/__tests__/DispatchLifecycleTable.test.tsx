import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DispatchLifecycleTable } from '../components/DispatchLifecycleTable'
import type { DispatchLifecycleRow } from '../hooks/useDispatchLifecycle'

function makeRow(overrides: Partial<DispatchLifecycleRow> = {}): DispatchLifecycleRow {
  return {
    dispatchId: overrides.dispatchId ?? crypto.randomUUID(),
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

  it('renders table with report, responder, status, fcm, escalation columns', () => {
    const rows: DispatchLifecycleRow[] = [makeRow()]
    render(<DispatchLifecycleTable rows={rows} />)

    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()

    const headers = screen.getAllByRole('columnheader')
    const headerTexts = headers.map((h) => h.textContent || '')
    expect(headerTexts).toEqual(
      expect.arrayContaining(['Report', 'Responder', 'Status', 'FCM', 'Escalations']),
    )
  })

  it('shows reportId first 8 characters in Report column', () => {
    const rows: DispatchLifecycleRow[] = [makeRow({ reportId: 'rep-12345-abcde' })]
    render(<DispatchLifecycleTable rows={rows} />)
    expect(screen.getByText('rep-1234')).toBeInTheDocument()
  })

  it.each([
    ['pending', 'Pending', 'bg-amber-100', 'text-amber-800'],
    ['accepted', 'Accepted', 'bg-blue-100', 'text-blue-800'],
    ['declined', 'Declined', 'bg-red-100', 'text-red-800'],
    ['needs_admin', 'Needs Admin', 'bg-red-100', 'text-red-800'],
  ] as const)('renders %s badge with correct colors', (status, label, bgColor, textColor) => {
    const rows: DispatchLifecycleRow[] = [makeRow({ status })]
    render(<DispatchLifecycleTable rows={rows} />)
    const badge = screen.getByText(label)
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass(bgColor)
    expect(badge).toHaveClass(textColor)
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
})
