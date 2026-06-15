import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusExpanded } from './StatusExpanded'

function renderStatusExpanded(props: Partial<React.ComponentProps<typeof StatusExpanded>> = {}) {
  return render(
    <StatusExpanded
      resolvedToday={undefined}
      muniIssues={undefined}
      stalledDispatchCount={0}
      fcmSuccessRate={null}
      avgAcceptSeconds={null}
      isSurge={false}
      {...props}
    />,
  )
}

describe('StatusExpanded — FCM rate null-gate', () => {
  it('renders em-dash when fcmSuccessRate is null (not-yet-measured)', () => {
    renderStatusExpanded({ fcmSuccessRate: null })
    const fcmEl = screen.getByTestId('statusbar-fcm-rate')
    expect(fcmEl).toHaveTextContent('—')
    expect(fcmEl).not.toHaveTextContent('0%')
  })

  it('renders 0% when fcmSuccessRate is 0 (genuine measured zero)', () => {
    renderStatusExpanded({ fcmSuccessRate: 0 })
    const fcmEl = screen.getByTestId('statusbar-fcm-rate')
    expect(fcmEl).toHaveTextContent('0%')
  })

  it('renders 95% when fcmSuccessRate is 0.95', () => {
    renderStatusExpanded({ fcmSuccessRate: 0.95 })
    const fcmEl = screen.getByTestId('statusbar-fcm-rate')
    expect(fcmEl).toHaveTextContent('95%')
  })

  it('does not render a percentage when null', () => {
    renderStatusExpanded({ fcmSuccessRate: null })
    const fcmEl = screen.getByTestId('statusbar-fcm-rate')
    expect(fcmEl.textContent).not.toMatch(/%/)
  })
})
