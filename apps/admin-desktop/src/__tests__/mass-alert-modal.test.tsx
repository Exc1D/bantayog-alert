import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../app/firebase', () => ({ db: {} }))

const mockPreview = vi.hoisted(() => vi.fn())
const mockSend = vi.hoisted(() => vi.fn())
const mockEscalate = vi.hoisted(() => vi.fn())

vi.mock('../services/callables', () => ({
  callables: {
    massAlertReachPlanPreview: mockPreview,
    sendMassAlert: mockSend,
    requestMassAlertEscalation: mockEscalate,
  },
}))

import { MassAlertModal } from '../pages/MassAlertModal'

const DIRECT_PLAN = {
  route: 'direct',
  fcmCount: 200,
  smsCount: 150,
  segmentCount: 1,
  unicodeWarning: false,
}
const NDRRMC_PLAN = {
  route: 'ndrrmc_escalation',
  fcmCount: 6000,
  smsCount: 2000,
  segmentCount: 1,
  unicodeWarning: false,
}

describe('MassAlertModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPreview.mockResolvedValue(DIRECT_PLAN)
    mockSend.mockResolvedValue({ requestId: 'req-1' })
    mockEscalate.mockResolvedValue({ requestId: 'req-2' })
  })

  it('shows GSM-7 indicator and correct segment count for ASCII message', async () => {
    const user = userEvent.setup()
    render(<MassAlertModal municipalityId="daet" onClose={vi.fn()} />)
    await user.type(screen.getByLabelText(/message/i), 'ALERT: Typhoon warning')
    expect(screen.getByText(/GSM-7/i)).toBeInTheDocument()
  })

  it('shows UCS-2 warning when message contains unicode characters', async () => {
    const user = userEvent.setup()
    mockPreview.mockResolvedValue({ ...DIRECT_PLAN, unicodeWarning: true })
    render(<MassAlertModal municipalityId="daet" onClose={vi.fn()} />)
    await user.type(screen.getByLabelText(/message/i), 'Alerto sa ñ lugar')
    await user.click(screen.getByRole('button', { name: /preview reach/i }))
    expect(await screen.findByText(/⚠ UCS-2 \(multi-byte\)/i)).toBeInTheDocument()
  })

  it('shows Preview Reach button', () => {
    render(<MassAlertModal municipalityId="daet" onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /preview reach/i })).toBeInTheDocument()
  })

  it('shows fcmCount and smsCount after preview loads', async () => {
    const user = userEvent.setup()
    render(<MassAlertModal municipalityId="daet" onClose={vi.fn()} />)
    await user.type(screen.getByLabelText(/message/i), 'Test alert')
    await user.click(screen.getByRole('button', { name: /preview reach/i }))
    expect(await screen.findByText(/200/)).toBeInTheDocument()
    expect(screen.getByText(/150/)).toBeInTheDocument()
  })

  it('shows Direct Send badge when route is direct', async () => {
    const user = userEvent.setup()
    render(<MassAlertModal municipalityId="daet" onClose={vi.fn()} />)
    await user.type(screen.getByLabelText(/message/i), 'Test')
    await user.click(screen.getByRole('button', { name: /preview reach/i }))
    expect(await screen.findByText(/direct/i)).toBeInTheDocument()
  })

  it('shows NDRRMC Escalation badge when route is ndrrmc_escalation', async () => {
    mockPreview.mockResolvedValue(NDRRMC_PLAN)
    const user = userEvent.setup()
    render(<MassAlertModal municipalityId="daet" onClose={vi.fn()} />)
    await user.type(screen.getByLabelText(/message/i), 'Test')
    await user.click(screen.getByRole('button', { name: /preview reach/i }))
    expect(await screen.findByText(/NDRRMC escalation required/i)).toBeInTheDocument()
  })

  it('disables Send button when route is ndrrmc_escalation', async () => {
    mockPreview.mockResolvedValue(NDRRMC_PLAN)
    const user = userEvent.setup()
    render(<MassAlertModal municipalityId="daet" onClose={vi.fn()} />)
    await user.type(screen.getByLabelText(/message/i), 'Test')
    await user.click(screen.getByRole('button', { name: /preview reach/i }))
    await screen.findByText(/NDRRMC escalation required/i)
    expect(screen.getByRole('button', { name: /^send alert$/i })).toBeDisabled()
  })

  it('shows Request NDRRMC Escalation button when route is ndrrmc_escalation', async () => {
    mockPreview.mockResolvedValue(NDRRMC_PLAN)
    const user = userEvent.setup()
    render(<MassAlertModal municipalityId="daet" onClose={vi.fn()} />)
    await user.type(screen.getByLabelText(/message/i), 'Test')
    await user.click(screen.getByRole('button', { name: /preview reach/i }))
    expect(
      await screen.findByRole('button', { name: /request ndrrmc escalation/i }),
    ).toBeInTheDocument()
  })

  it('calls sendMassAlert on Send click (direct path)', async () => {
    const user = userEvent.setup()
    render(<MassAlertModal municipalityId="daet" onClose={vi.fn()} />)
    await user.type(screen.getByLabelText(/message/i), 'Test alert')
    await user.click(screen.getByRole('button', { name: /preview reach/i }))
    await screen.findByText(/200/)
    await user.click(screen.getByRole('button', { name: /^send alert$/i }))
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('calls requestMassAlertEscalation on escalation CTA click', async () => {
    mockPreview.mockResolvedValue(NDRRMC_PLAN)
    const user = userEvent.setup()
    render(<MassAlertModal municipalityId="daet" onClose={vi.fn()} />)
    await user.type(screen.getByLabelText(/message/i), 'Test')
    await user.click(screen.getByRole('button', { name: /preview reach/i }))
    await user.click(await screen.findByRole('button', { name: /request ndrrmc escalation/i }))
    expect(mockEscalate).toHaveBeenCalledTimes(1)
  })
})
