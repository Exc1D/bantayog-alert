import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DispatchStatsCards } from '../components/DispatchStatsCards'

describe('Dispatch KPI trend semantics', () => {
  it('does not turn consecutive polls into a trend', () => {
    const props = {
      activeCount: 5,
      stalledCount: 0,
      fcmSuccessRate: 0.95,
      mode: 'active' as const,
    }
    const { rerender } = render(<DispatchStatsCards {...props} avgAcceptSeconds={100} />)
    rerender(<DispatchStatsCards {...props} avgAcceptSeconds={120} />)

    const cardText = screen.getByLabelText('Average accept time').textContent ?? ''
    expect(cardText).not.toContain(String.fromCharCode(8593))
    expect(cardText).not.toContain(String.fromCharCode(8595))
  })
})
