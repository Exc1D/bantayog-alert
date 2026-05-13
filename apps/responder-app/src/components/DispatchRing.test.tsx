import { describe, expect, it } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { DispatchRing } from './DispatchRing'

describe('DispatchRing', () => {
  it('renders a progress ring with an accessible label', () => {
    render(
      <DispatchRing mode="progress" percent={60} tone="success" ariaLabel="Progress 60 percent">
        <span>60%</span>
      </DispatchRing>,
    )

    expect(screen.getByRole('img', { name: /progress 60 percent/i })).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
  })

  it('renders urgent countdown rings as alerts', () => {
    render(
      <DispatchRing
        mode="countdown"
        percent={15}
        tone="urgent"
        ariaLabel="Accept in 0 minutes 59 seconds urgent"
        urgent
      >
        <span>0:59</span>
      </DispatchRing>,
    )

    expect(screen.getByRole('alert', { name: /urgent/i })).toBeInTheDocument()
  })
})
