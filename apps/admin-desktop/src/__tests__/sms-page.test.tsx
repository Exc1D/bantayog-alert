import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SmsPage from '../pages/SmsPage'

vi.mock('@/app/firebase', () => ({ db: {} }))

const { mockUseSmsAudit } = vi.hoisted(() => ({
  mockUseSmsAudit: vi.fn(() => ({
    outbox: [] as unknown[],
    inbox: [] as unknown[],
    providerHealth: [] as unknown[],
    loading: false,
    error: null as string | null,
  })),
}))

vi.mock('@/hooks/useSmsAudit', () => ({
  useSmsAudit: () => mockUseSmsAudit(),
}))

vi.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('SmsPage', () => {
  beforeEach(() => {
    mockUseSmsAudit.mockReturnValue({
      outbox: [],
      inbox: [],
      providerHealth: [],
      loading: false,
      error: null,
    })
  })

  it('renders tab navigation', () => {
    render(<SmsPage />)

    expect(screen.getByRole('tab', { name: /outbox/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /inbox/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /provider health/i })).toBeInTheDocument()
  })

  it('shows empty state for outbox tab', () => {
    render(<SmsPage />)

    expect(screen.getByText(/no outbox messages/i)).toBeInTheDocument()
  })

  it('shows loading state', () => {
    mockUseSmsAudit.mockReturnValue({
      outbox: [],
      inbox: [],
      providerHealth: [],
      loading: true,
      error: null,
    })

    render(<SmsPage />)

    expect(screen.getByText(/loading sms data/i)).toBeInTheDocument()
  })

  it('shows error state', () => {
    mockUseSmsAudit.mockReturnValue({
      outbox: [],
      inbox: [],
      providerHealth: [],
      loading: false,
      error: 'Permission denied',
    })

    render(<SmsPage />)

    expect(screen.getByText(/failed to load sms data/i)).toBeInTheDocument()
    expect(screen.getByText(/permission denied/i)).toBeInTheDocument()
  })

  it('switches to inbox tab and shows empty state', async () => {
    const user = userEvent.setup()
    render(<SmsPage />)

    await user.click(screen.getByRole('tab', { name: /inbox/i }))

    expect(screen.getByText(/no inbox messages/i)).toBeInTheDocument()
  })

  it('switches to provider health tab and shows empty state', async () => {
    const user = userEvent.setup()
    render(<SmsPage />)

    await user.click(screen.getByRole('tab', { name: /provider health/i }))

    expect(screen.getByText(/no provider health data/i)).toBeInTheDocument()
  })

  it('renders outbox table with status badges when data is present', () => {
    mockUseSmsAudit.mockReturnValue({
      outbox: [
        {
          id: 'out-1',
          recipientMsisdnHash: 'a'.repeat(64),
          purpose: 'verification',
          status: 'delivered',
          predictedSegmentCount: 1,
          createdAt: 1714900000,
        },
      ],
      inbox: [],
      providerHealth: [],
      loading: false,
      error: null,
    })

    render(<SmsPage />)

    expect(screen.getByRole('columnheader', { name: /recipient hash/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /purpose/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /segments/i })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: /delivered/i })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: /verification/i })).toBeInTheDocument()
  })

  it('applies correct color class to delivered outbox badge', () => {
    mockUseSmsAudit.mockReturnValue({
      outbox: [
        {
          id: 'out-1',
          recipientMsisdnHash: 'a'.repeat(64),
          purpose: 'verification',
          status: 'delivered',
          predictedSegmentCount: 1,
          createdAt: 1714900000,
        },
      ],
      inbox: [],
      providerHealth: [],
      loading: false,
      error: null,
    })

    render(<SmsPage />)

    const badge = screen.getByRole('cell', { name: /delivered/i }).querySelector('span')
    expect(badge).toHaveClass('bg-green-50', 'text-green-800')
  })

  it('applies correct color class to failed outbox badge', () => {
    mockUseSmsAudit.mockReturnValue({
      outbox: [
        {
          id: 'out-2',
          recipientMsisdnHash: 'b'.repeat(64),
          purpose: 'mass_alert',
          status: 'failed',
          predictedSegmentCount: 2,
          createdAt: 1714900000,
        },
      ],
      inbox: [],
      providerHealth: [],
      loading: false,
      error: null,
    })

    render(<SmsPage />)

    const badge = screen.getByRole('cell', { name: /failed/i }).querySelector('span')
    expect(badge).toHaveClass('bg-red-50', 'text-red-800')
  })

  it('renders inbox table with parse status and confidence when data is present', async () => {
    mockUseSmsAudit.mockReturnValue({
      outbox: [],
      inbox: [
        {
          id: 'in-1',
          senderMsisdnHash: 'b'.repeat(64),
          body: 'Flood in Barangay 1',
          parseStatus: 'parsed',
          confidenceScore: 0.95,
          parsedIntoInboxId: 'report-123',
          receivedAt: 1714900000,
        },
      ],
      providerHealth: [],
      loading: false,
      error: null,
    })

    const user = userEvent.setup()
    render(<SmsPage />)

    await user.click(screen.getByRole('tab', { name: /inbox/i }))

    expect(screen.getByRole('columnheader', { name: /sender hash/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /body/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /parse status/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /confidence/i })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: /parsed/i })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: /Flood in Barangay 1/i })).toBeInTheDocument()
  })

  it('renders provider health cards when data is present', async () => {
    mockUseSmsAudit.mockReturnValue({
      outbox: [],
      inbox: [],
      providerHealth: [
        {
          id: 'health-1',
          providerId: 'semaphore',
          circuitState: 'closed',
          errorRatePct: 0,
          lastTransitionReason: 'probe_succeeded',
          lastProbeAt: 1714900000,
        },
      ],
      loading: false,
      error: null,
    })

    const user = userEvent.setup()
    render(<SmsPage />)

    await user.click(screen.getByRole('tab', { name: /provider health/i }))

    expect(screen.getByText(/semaphore/i)).toBeInTheDocument()
    expect(screen.getByText(/closed/i)).toBeInTheDocument()
    expect(screen.getByText(/0%/)).toBeInTheDocument()
    expect(screen.getByText(/probe_succeeded/i)).toBeInTheDocument()
  })

  it('applies correct color class to parsed inbox badge', async () => {
    mockUseSmsAudit.mockReturnValue({
      outbox: [],
      inbox: [
        {
          id: 'in-1',
          senderMsisdnHash: 'b'.repeat(64),
          body: 'Flood',
          parseStatus: 'parsed',
          confidenceScore: 0.95,
          parsedIntoInboxId: 'report-123',
          receivedAt: 1714900000,
        },
      ],
      providerHealth: [],
      loading: false,
      error: null,
    })

    const user = userEvent.setup()
    render(<SmsPage />)
    await user.click(screen.getByRole('tab', { name: /inbox/i }))

    const badge = screen.getByRole('cell', { name: /parsed/i }).querySelector('span')
    expect(badge).toHaveClass('bg-green-50', 'text-green-800')
  })

  it('applies correct color class to open circuit badge', async () => {
    mockUseSmsAudit.mockReturnValue({
      outbox: [],
      inbox: [],
      providerHealth: [
        {
          id: 'health-1',
          providerId: 'globelabs',
          circuitState: 'open',
          errorRatePct: 50,
          lastTransitionReason: 'threshold_exceeded',
          lastProbeAt: 1714900000,
        },
      ],
      loading: false,
      error: null,
    })

    const user = userEvent.setup()
    render(<SmsPage />)
    await user.click(screen.getByRole('tab', { name: /provider health/i }))

    const badge = screen.getByText(/open/i).closest('span')
    expect(badge).toHaveClass('bg-red-50', 'text-red-800')
  })

  it('filters outbox messages by search query', async () => {
    mockUseSmsAudit.mockReturnValue({
      outbox: [
        {
          id: 'out-1',
          recipientMsisdnHash: 'a'.repeat(64),
          purpose: 'verification',
          status: 'delivered',
          predictedSegmentCount: 1,
          createdAt: 1714900000,
        },
        {
          id: 'out-2',
          recipientMsisdnHash: 'b'.repeat(64),
          purpose: 'mass_alert',
          status: 'failed',
          predictedSegmentCount: 2,
          createdAt: 1714900000,
        },
      ],
      inbox: [],
      providerHealth: [],
      loading: false,
      error: null,
    })

    const user = userEvent.setup()
    render(<SmsPage />)

    await user.type(screen.getByPlaceholderText(/search/i), 'mass_alert')

    expect(screen.getByRole('cell', { name: /mass_alert/i })).toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: /verification/i })).not.toBeInTheDocument()
  })

  it('filters inbox messages by search query', async () => {
    mockUseSmsAudit.mockReturnValue({
      outbox: [],
      inbox: [
        {
          id: 'in-1',
          senderMsisdnHash: 'a'.repeat(64),
          body: 'Flood in Barangay 1',
          parseStatus: 'parsed',
          confidenceScore: 0.9,
          parsedIntoInboxId: 'report-123',
          receivedAt: 1714900000,
        },
        {
          id: 'in-2',
          senderMsisdnHash: 'b'.repeat(64),
          body: 'Fire downtown',
          parseStatus: 'unparseable',
          confidenceScore: 0.1,
          parsedIntoInboxId: undefined,
          receivedAt: 1714900000,
        },
      ],
      providerHealth: [],
      loading: false,
      error: null,
    })

    const user = userEvent.setup()
    render(<SmsPage />)
    await user.click(screen.getByRole('tab', { name: /inbox/i }))

    await user.type(screen.getByPlaceholderText(/search/i), 'Fire')

    expect(screen.getByRole('cell', { name: /Fire downtown/i })).toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: /Flood in Barangay 1/i })).not.toBeInTheDocument()
  })

  it('shows title tooltip on truncated inbox body', async () => {
    mockUseSmsAudit.mockReturnValue({
      outbox: [],
      inbox: [
        {
          id: 'in-1',
          senderMsisdnHash: 'b'.repeat(64),
          body: 'Flood in Barangay 1',
          parseStatus: 'parsed',
          confidenceScore: 0.95,
          parsedIntoInboxId: 'report-123',
          receivedAt: 1714900000,
        },
      ],
      providerHealth: [],
      loading: false,
      error: null,
    })

    const user = userEvent.setup()
    render(<SmsPage />)
    await user.click(screen.getByRole('tab', { name: /inbox/i }))

    const bodyCell = screen.getByRole('cell', { name: /Flood in Barangay 1/i })
    expect(bodyCell).toHaveAttribute('title', 'Flood in Barangay 1')
  })
})
