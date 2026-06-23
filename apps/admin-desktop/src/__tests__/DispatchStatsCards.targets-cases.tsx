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

describe('DispatchStatsCards targets', () => {
  it('shows explicit targets and current status', () => {
    render(<DispatchStatsCards {...props} />)

    expect(screen.getByLabelText('Active Now')).toHaveTextContent('Target max 20')
    expect(screen.getByLabelText('Active Now')).toHaveTextContent('Watch')
    expect(screen.getByLabelText('Stalled')).toHaveTextContent('Target 0')
    expect(screen.getByLabelText('Stalled')).toHaveTextContent('OK')
    expect(screen.getByLabelText('Average accept time')).toHaveTextContent('Target max 5m')
    expect(screen.getByLabelText('Average accept time')).toHaveTextContent('OK')
    expect(screen.getByLabelText('FCM success rate')).toHaveTextContent('Target min 90%')
    expect(screen.getByLabelText('FCM success rate')).toHaveTextContent('OK')
  })

  it('prioritizes active and stalled cards in surge mode', () => {
    render(<DispatchStatsCards {...props} mode="surge" />)

    expect(screen.getByLabelText('Active Now')).toHaveTextContent('Action required')
    expect(screen.getByLabelText('Stalled')).toBeInTheDocument()
    expect(screen.queryByLabelText('Average accept time')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('FCM success rate')).not.toBeInTheDocument()
  })
})
