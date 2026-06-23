import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DispatchStatsCards } from '../components/DispatchStatsCards'

const props = {
  activeCount: 5,
  stalledCount: 0,
  avgAcceptSeconds: 150 as number | null,
  fcmSuccessRate: 0.95 as number | null,
  mode: 'active' as const,
}

describe('DispatchStatsCards', () => {
  it('shows targets and current decision statuses', () => {
    render(<DispatchStatsCards {...props} />)

    expect(screen.getByLabelText('Active Now')).toHaveTextContent('Target ≤ 20')
    expect(screen.getByLabelText('Active Now')).toHaveTextContent('Watch')
    expect(screen.getByLabelText('Stalled')).toHaveTextContent('Target 0')
    expect(screen.getByLabelText('Stalled')).toHaveTextContent('OK')
    expect(screen.getByLabelText('Average accept time')).toHaveTextContent('Target ≤ 5m')
    expect(screen.getByLabelText('Average accept time')).toHaveTextContent('OK')
    expect(screen.getByLabelText('FCM success rate')).toHaveTextContent('Target ≥ 90%')
    expect(screen.getByLabelText('FCM success rate')).toHaveTextContent('OK')
  })

  it('marks breached thresholds for operator action', () => {
    render(
      <DispatchStatsCards
        {...props}
        activeCount={21}
        stalledCount={2}
        avgAcceptSeconds={601}
        fcmSuccessRate={0.79}
      />,
    )

    expect(screen.getByLabelText('Active Now')).toHaveTextContent('Action required')
    expect(screen.getByLabelText('Stalled')).toHaveTextContent('Action required')
    expect(screen.getByLabelText('Average accept time')).toHaveTextContent('Action required')
    expect(screen.getByLabelText('FCM success rate')).toHaveTextContent('Action required')
  })

  it('uses stable thresholds instead of consecutive polls as a trend', () => {
    const { rerender } = render(<DispatchStatsCards {...props} avgAcceptSeconds={301} />)
    expect(screen.getByLabelText('Average accept time')).toHaveTextContent('Watch')

    rerender(<DispatchStatsCards {...props} avgAcceptSeconds={601} />)
    const card = screen.getByLabelText('Average accept time')
    expect(card).not.toHaveTextContent(String.fromCharCode(8593))
    expect(card).not.toHaveTextContent(String.fromCharCode(8595))
  })

  it('does not fabricate missing backend measurements', () => {
    render(<DispatchStatsCards {...props} avgAcceptSeconds={null} fcmSuccessRate={null} />)

    expect(screen.getByLabelText('Average accept time')).toHaveTextContent('—')
    expect(screen.getByLabelText('Average accept time')).toHaveTextContent('Unavailable')
    expect(screen.getByLabelText('FCM success rate')).toHaveTextContent('—')
    expect(screen.getByLabelText('FCM success rate')).toHaveTextContent('Unavailable')
  })

  it('keeps only the urgent cards visible in surge mode', () => {
    render(<DispatchStatsCards {...props} mode="surge" />)

    expect(screen.getByLabelText('Active Now')).toBeInTheDocument()
    expect(screen.getByLabelText('Stalled')).toBeInTheDocument()
    expect(screen.queryByLabelText('Average accept time')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('FCM success rate')).not.toBeInTheDocument()
  })
})
