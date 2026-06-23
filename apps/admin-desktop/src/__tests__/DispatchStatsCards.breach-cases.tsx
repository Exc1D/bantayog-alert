import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DispatchStatsCards } from '../components/DispatchStatsCards'

describe('Dispatch KPI breach statuses', () => {
  it('marks breached targets as action required', () => {
    render(
      <DispatchStatsCards
        activeCount={5}
        stalledCount={2}
        avgAcceptSeconds={601}
        fcmSuccessRate={0.79}
        mode="active"
      />,
    )

    expect(screen.getByLabelText('Stalled')).toHaveTextContent('Action required')
    expect(screen.getByLabelText('Average accept time')).toHaveTextContent('Action required')
    expect(screen.getByLabelText('FCM success rate')).toHaveTextContent('Action required')
  })
})
