import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  ResponderRosterSection,
  partitionRoster,
  canReinstate,
} from '../components/ResponderRosterSection'
import type { ResponderRosterMember } from '../hooks/useResponderRoster'

function member(overrides: Partial<ResponderRosterMember>): ResponderRosterMember {
  return {
    uid: 'r1',
    displayName: 'Alice',
    availabilityStatus: 'off_duty',
    accountStatus: 'active',
    lastActivityAt: 0,
    ...overrides,
  }
}

describe('partitionRoster / canReinstate', () => {
  it('keeps only non-available responders', () => {
    const result = partitionRoster([
      member({ uid: 'a', availabilityStatus: 'available' }),
      member({ uid: 'b', availabilityStatus: 'off_duty' }),
      member({ uid: 'c', availabilityStatus: 'unavailable' }),
    ])
    expect(result.map((m) => m.uid)).toEqual(['b', 'c'])
  })

  it('reinstates only active, non-available accounts', () => {
    expect(canReinstate(member({ availabilityStatus: 'off_duty', accountStatus: 'active' }))).toBe(
      true,
    )
    expect(canReinstate(member({ availabilityStatus: 'available' }))).toBe(false)
    expect(canReinstate(member({ accountStatus: 'suspended' }))).toBe(false)
    expect(canReinstate(member({ accountStatus: 'revoked' }))).toBe(false)
  })
})

describe('ResponderRosterSection', () => {
  it('reinstates an off-duty responder and hides the button for suspended ones', () => {
    const onReinstate = vi.fn()
    render(
      <ResponderRosterSection
        members={[
          member({ uid: 'off', displayName: 'Off Duty', availabilityStatus: 'off_duty' }),
          member({
            uid: 'susp',
            displayName: 'Suspended',
            availabilityStatus: 'unavailable',
            accountStatus: 'suspended',
          }),
          member({ uid: 'avail', displayName: 'Available', availabilityStatus: 'available' }),
        ]}
        onReinstate={onReinstate}
      />,
    )

    // available responder is excluded from the roster section
    expect(screen.queryByText('Available')).not.toBeInTheDocument()
    // suspended shows a read-only note, not a reinstate button
    expect(screen.getByText('Reinstate via account tools')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /set available/i }))
    expect(onReinstate).toHaveBeenCalledWith('off')
  })

  it('renders nothing when everyone is available', () => {
    const { container } = render(
      <ResponderRosterSection
        members={[member({ availabilityStatus: 'available' })]}
        onReinstate={vi.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
