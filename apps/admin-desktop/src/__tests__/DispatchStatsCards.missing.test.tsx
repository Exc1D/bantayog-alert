import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DispatchStatsCards } from '../components/DispatchStatsCards'

describe('Dispatch KPI unavailable states', () => {
  it('does not fabricate missing backend measurements', () => {
    render(
      <DispatchStatsCards
        activeCount={5}
        stalledCount={0}
        avgAcceptSeconds={null}
        fcmSuccessRate={null}
        mode="active"
      />,
    )

    expect(screen.getByLabelText('Average accept time')).toHaveTextContent('—')
    expect(screen.getByLabelText('Average accept time')).toHaveTextContent('Unavailable')
    expect(screen.getByLabelText('FCM success rate')).toHaveTextContent('—')
    expect(screen.getByLabelText('FCM success rate')).toHaveTextContent('Unavailable')
  })
})
