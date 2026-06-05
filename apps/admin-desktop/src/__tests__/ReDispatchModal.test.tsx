import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReDispatchModal } from '../components/ReDispatchModal'
import type { ResponderFleetMember } from '../hooks/useResponderFleet'

function responderStub(
  overrides: Partial<ResponderFleetMember> & { uid: string },
): ResponderFleetMember {
  return {
    displayName: 'John Doe',
    availabilityStatus: 'available',
    lastActivityAt: Date.now(),
    onlineStatus: 'online',
    ...overrides,
  }
}

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onDispatch: vi.fn(),
  responders: [] as ResponderFleetMember[],
  previouslyNotified: [] as string[],
  isLoading: false,
}

describe('ReDispatchModal', () => {
  it('does not render when closed', () => {
    render(<ReDispatchModal {...baseProps} isOpen={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders title and close button when open', () => {
    render(<ReDispatchModal {...baseProps} />)
    expect(screen.getByRole('heading', { name: /re-dispatch/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ReDispatchModal {...baseProps} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  describe('with candidates available', () => {
    const responders: ResponderFleetMember[] = [
      responderStub({
        uid: 'r1',
        displayName: 'Alice',
        lastActivityAt: 3000,
        onlineStatus: 'online',
      }),
      responderStub({
        uid: 'r2',
        displayName: 'Bob',
        lastActivityAt: 2000,
        onlineStatus: 'away',
      }),
      responderStub({
        uid: 'r3',
        displayName: 'Charlie',
        lastActivityAt: 1000,
        onlineStatus: 'offline',
      }),
      responderStub({
        uid: 'r4',
        displayName: 'David',
        lastActivityAt: 500,
        onlineStatus: 'online',
      }),
    ]

    it('shows recommended section heading', () => {
      render(<ReDispatchModal {...baseProps} responders={responders} />)
      expect(screen.getByText(/recommended/i)).toBeInTheDocument()
    })

    it('shows only top 3 candidates sorted by lastActivityAt desc', () => {
      render(<ReDispatchModal {...baseProps} responders={responders} />)
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(screen.getByText('Charlie')).toBeInTheDocument()
      expect(screen.queryByText('David')).not.toBeInTheDocument()
    })

    it('does not show force re-notify when candidates exist', () => {
      render(<ReDispatchModal {...baseProps} responders={responders} />)
      expect(screen.queryByRole('button', { name: /force re-notify/i })).not.toBeInTheDocument()
    })

    it('filters out previously notified responders from recommendations', () => {
      render(<ReDispatchModal {...baseProps} responders={responders} previouslyNotified={['r1']} />)
      expect(screen.queryByText('Alice')).not.toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(screen.getByText('Charlie')).toBeInTheDocument()
      expect(screen.getByText('David')).toBeInTheDocument()
    })

    it('shows online status for each candidate', () => {
      render(<ReDispatchModal {...baseProps} responders={responders} />)
      const aliceRow = screen.getByText('Alice').closest('li') as HTMLElement
      expect(aliceRow).toHaveTextContent(/online/i)
    })

    it('highlights selected candidate with blue border and background', async () => {
      const user = userEvent.setup()
      render(<ReDispatchModal {...baseProps} responders={responders} />)
      const aliceButton = screen.getByText('Alice').closest('button')!
      await user.click(aliceButton)
      expect(aliceButton).toHaveClass('border-blue-500')
    })

    it('disables dispatch button until a candidate is selected', () => {
      render(<ReDispatchModal {...baseProps} responders={responders} />)
      const dispatchBtn = screen.getByRole('button', {
        name: /dispatch selected/i,
      })
      expect(dispatchBtn).toBeDisabled()
    })

    it('enables dispatch button after selecting a candidate', async () => {
      const user = userEvent.setup()
      render(<ReDispatchModal {...baseProps} responders={responders} />)
      const aliceButton = screen.getByText('Alice').closest('button')!
      await user.click(aliceButton)
      const dispatchBtn = screen.getByRole('button', {
        name: /dispatch selected/i,
      })
      expect(dispatchBtn).toBeEnabled()
    })

    it('calls onDispatch with selected uid when dispatch button clicked', async () => {
      const user = userEvent.setup()
      const onDispatch = vi.fn()
      render(<ReDispatchModal {...baseProps} responders={responders} onDispatch={onDispatch} />)
      await user.click(screen.getByText('Alice').closest('button') as HTMLElement)
      await user.click(screen.getByRole('button', { name: /dispatch selected/i }))
      expect(onDispatch).toHaveBeenCalledExactlyOnceWith('r1', undefined)
    })

    it('disables dispatch button while loading', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<ReDispatchModal {...baseProps} responders={responders} />)
      await user.click(screen.getByText('Alice').closest('button') as HTMLElement)
      rerender(<ReDispatchModal {...baseProps} responders={responders} isLoading={true} />)
      const dispatchBtn = screen.getByRole('button', {
        name: /dispatch/i,
      })
      expect(dispatchBtn).toBeDisabled()
    })
  })

  describe('with no candidates (all excluded by previouslyNotified)', () => {
    const responders: ResponderFleetMember[] = [
      responderStub({
        uid: 'r1',
        displayName: 'Alice',
        lastActivityAt: 3000,
        onlineStatus: 'online',
      }),
    ]

    it('shows no new candidates available message', () => {
      render(<ReDispatchModal {...baseProps} responders={responders} previouslyNotified={['r1']} />)
      expect(screen.getByText(/no new candidates available/i)).toBeInTheDocument()
    })

    it('shows force re-notify button', () => {
      render(<ReDispatchModal {...baseProps} responders={responders} previouslyNotified={['r1']} />)
      expect(screen.getByRole('button', { name: /force re-notify/i })).toBeInTheDocument()
    })

    it('does not show recommended section', () => {
      render(<ReDispatchModal {...baseProps} responders={responders} previouslyNotified={['r1']} />)
      expect(screen.queryByText(/recommended/i)).not.toBeInTheDocument()
    })

    it('does not show dispatch selected button', () => {
      render(<ReDispatchModal {...baseProps} responders={responders} previouslyNotified={['r1']} />)
      expect(screen.queryByRole('button', { name: /dispatch selected/i })).not.toBeInTheDocument()
    })

    it('opens force confirmation dialog when force re-notify clicked', async () => {
      const user = userEvent.setup()
      render(<ReDispatchModal {...baseProps} responders={responders} previouslyNotified={['r1']} />)
      await user.click(screen.getByRole('button', { name: /force re-notify/i }))
      expect(
        screen.getByText(/force re-notify the most recently active responder/i),
      ).toBeInTheDocument()
    })

    it('has red force confirm button and cancel button in dialog', async () => {
      const user = userEvent.setup()
      render(<ReDispatchModal {...baseProps} responders={responders} previouslyNotified={['r1']} />)
      await user.click(screen.getByRole('button', { name: /force re-notify/i }))
      const confirmBtn = screen.getByRole('button', {
        name: /^force re-notify$/i,
      })
      expect(confirmBtn).toHaveClass('bg-red-600')
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('calls onDispatch with forceOverride=true when force confirmed', async () => {
      const user = userEvent.setup()
      const onDispatch = vi.fn()
      render(
        <ReDispatchModal
          {...baseProps}
          responders={responders}
          previouslyNotified={['r1']}
          onDispatch={onDispatch}
        />,
      )
      await user.click(screen.getByRole('button', { name: /force re-notify/i }))
      await user.click(screen.getByRole('button', { name: /^force re-notify$/i }))
      expect(onDispatch).toHaveBeenCalledExactlyOnceWith('r1', true)
    })

    it('closes force dialog when cancel clicked', async () => {
      const user = userEvent.setup()
      render(<ReDispatchModal {...baseProps} responders={responders} previouslyNotified={['r1']} />)
      await user.click(screen.getByRole('button', { name: /force re-notify/i }))
      await user.click(screen.getByRole('button', { name: /cancel/i }))
      expect(
        screen.queryByText(/force re-notify the most recently active responder/i),
      ).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('handles empty responders array gracefully', () => {
      render(<ReDispatchModal {...baseProps} responders={[]} />)
      expect(screen.getByText(/no new candidates available/i)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /dispatch selected/i })).not.toBeInTheDocument()
    })

    it('shows force re-notify for most recently active even when multiple previously notified', () => {
      const responders: ResponderFleetMember[] = [
        responderStub({
          uid: 'r1',
          displayName: 'Alice',
          lastActivityAt: 3000,
        }),
        responderStub({
          uid: 'r2',
          displayName: 'Bob',
          lastActivityAt: 2000,
        }),
      ]
      render(
        <ReDispatchModal
          {...baseProps}
          responders={responders}
          previouslyNotified={['r1', 'r2']}
        />,
      )
      expect(screen.getByRole('button', { name: /force re-notify/i })).toBeInTheDocument()
    })
  })
})
