import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResponderAvailabilityPanel } from '../components/ResponderAvailabilityPanel'
import type { ResponderFleetMember } from '../hooks/useResponderFleet'

const mockResponders: ResponderFleetMember[] = [
  {
    uid: 'r1',
    displayName: 'Santos',
    availabilityStatus: 'available',
    lastActivityAt: Date.now(),
    onlineStatus: 'online',
    agencyId: 'bfp-daet',
    municipalityId: 'daet',
  },
  {
    uid: 'r2',
    displayName: 'Reyes',
    availabilityStatus: 'available',
    lastActivityAt: Date.now() - 10 * 60 * 1000,
    onlineStatus: 'away',
    agencyId: 'mdrrmo-daet',
    municipalityId: 'daet',
  },
  {
    uid: 'r3',
    displayName: 'Cruz',
    availabilityStatus: 'unavailable',
    lastActivityAt: Date.now() - 60 * 60 * 1000,
    onlineStatus: 'offline',
  },
]

describe('ResponderAvailabilityPanel', () => {
  it('shows empty state when no responders', () => {
    render(<ResponderAvailabilityPanel responders={[]} />)
    expect(screen.getByText('No responders online')).toBeInTheDocument()
  })

  it('renders header with responder count', () => {
    render(<ResponderAvailabilityPanel responders={mockResponders} />)
    expect(screen.getByText('Responders (3)')).toBeInTheDocument()
  })

  it('shows the responder account creation action when wired', () => {
    render(
      <ResponderAvailabilityPanel
        responders={mockResponders}
        onCreateResponder={() => Promise.resolve()}
      />,
    )
    expect(screen.getByRole('button', { name: /create responder account/i })).toBeInTheDocument()
  })

  it('renders display names for each responder', () => {
    render(<ResponderAvailabilityPanel responders={mockResponders} />)
    expect(screen.getByText('Santos')).toBeInTheDocument()
    expect(screen.getByText('Reyes')).toBeInTheDocument()
    expect(screen.getByText('Cruz')).toBeInTheDocument()
  })

  it('renders online status labels for each responder', () => {
    render(<ResponderAvailabilityPanel responders={mockResponders} />)
    expect(screen.getByText('online')).toBeInTheDocument()
    expect(screen.getByText('away')).toBeInTheDocument()
    expect(screen.getByText('offline')).toBeInTheDocument()
  })

  it('shows jurisdiction at a glance and progressively reveals operational details', async () => {
    const user = userEvent.setup()
    render(<ResponderAvailabilityPanel responders={[mockResponders[0]!]} />)

    expect(screen.getByText('bfp-daet')).toBeInTheDocument()
    expect(screen.getByText('daet')).toBeInTheDocument()
    expect(screen.queryByText('Last activity')).not.toBeInTheDocument()

    const detailsButton = screen.getByRole('button', { name: /view Santos responder details/i })
    expect(detailsButton).toHaveAttribute('aria-expanded', 'false')
    await user.click(detailsButton)

    expect(detailsButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Availability')).toBeInTheDocument()
    expect(screen.getByText('Last activity')).toBeInTheDocument()
    expect(screen.getByText(/^(Just now|\d+[mhd] ago)$/)).toBeInTheDocument()
  })

  it('shows a fallback when jurisdiction metadata is missing', () => {
    render(<ResponderAvailabilityPanel responders={[mockResponders[2]!]} />)
    expect(screen.getByText('Jurisdiction not assigned')).toBeInTheDocument()
  })

  it('renders green dot for online status', () => {
    const { container } = render(<ResponderAvailabilityPanel responders={[mockResponders[0]!]} />)
    const dot = container.querySelector('.bg-green-500')
    expect(dot).not.toBeNull()
  })

  it('renders amber dot for away status', () => {
    const { container } = render(<ResponderAvailabilityPanel responders={[mockResponders[1]!]} />)
    const dot = container.querySelector('.bg-amber-500')
    expect(dot).not.toBeNull()
  })

  it('renders gray dot for offline status', () => {
    const { container } = render(<ResponderAvailabilityPanel responders={[mockResponders[2]!]} />)
    const dot = container.querySelector('.bg-gray-500')
    expect(dot).not.toBeNull()
  })

  it('wraps list in scrollable container', () => {
    const { container } = render(<ResponderAvailabilityPanel responders={mockResponders} />)
    const scrollable = container.querySelector('.max-h-64.overflow-y-auto')
    expect(scrollable).not.toBeNull()
  })

  it('trims fields and parses comma-separated specializations on submit', async () => {
    const onCreateResponder = vi.fn(() => Promise.resolve())
    const user = userEvent.setup()
    render(<ResponderAvailabilityPanel responders={[]} onCreateResponder={onCreateResponder} />)
    await user.click(screen.getByRole('button', { name: /create responder account/i }))

    const nameInput = screen.getByLabelText('Responder display name')
    const phoneInput = screen.getByLabelText('Responder phone')
    const agencyInput = screen.getByLabelText('Responder agency')
    const municipalityInput = screen.getByLabelText('Responder municipality')
    const specializationsInput = screen.getByLabelText('Responder specializations')

    await user.type(nameInput, '  Juan Dela Cruz  ')
    await user.type(phoneInput, '+639171234567')
    await user.type(agencyInput, 'bfp-daet')
    await user.type(municipalityInput, 'daet')
    await user.type(specializationsInput, 'fire,  rescue ,  medical ')

    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(onCreateResponder).toHaveBeenCalledTimes(1)
    expect(onCreateResponder).toHaveBeenCalledWith({
      displayName: 'Juan Dela Cruz',
      phone: '+639171234567',
      agencyId: 'bfp-daet',
      municipalityId: 'daet',
      specializations: ['fire', 'rescue', 'medical'],
    })
  })
})
