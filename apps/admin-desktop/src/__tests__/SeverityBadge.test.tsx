import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SeverityBadge } from '../components/SeverityBadge'

describe('SeverityBadge', () => {
  it.each([
    ['high', 'HIGH'],
    ['medium', 'MED'],
    ['low', 'LOW'],
  ] as const)('renders %s severity', (severity, label) => {
    render(<SeverityBadge severity={severity} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})
