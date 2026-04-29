import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FilterBar, type Filters } from './FilterBar.js'

const filters: Filters = { severity: 'all', window: '24h' }

describe('FilterBar', () => {
  it('shows all severity and window options simultaneously', () => {
    render(<FilterBar filters={filters} onChange={vi.fn()} />)
    for (const label of ['All', 'High', 'Medium', 'Low', '24h', '7d', '30d']) {
      expect(
        screen.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }),
      ).toBeInTheDocument()
    }
  })

  it('selects severity directly on click', () => {
    const onChange = vi.fn()
    render(<FilterBar filters={filters} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /^high$/i }))
    expect(onChange).toHaveBeenCalledWith({ severity: 'high', window: '24h' })
  })

  it('selects window directly on click', () => {
    const onChange = vi.fn()
    render(<FilterBar filters={filters} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /^7d$/i }))
    expect(onChange).toHaveBeenCalledWith({ severity: 'all', window: '7d' })
  })

  it('marks the active severity chip as pressed', () => {
    render(<FilterBar filters={{ severity: 'high', window: '24h' }} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^high$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^all$/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('disables all chips and blocks onChange when requested', () => {
    const onChange = vi.fn()
    render(<FilterBar filters={filters} onChange={onChange} disabled />)
    for (const label of ['All', 'High', 'Medium', 'Low', '24h', '7d', '30d']) {
      expect(screen.getByRole('button', { name: new RegExp(`^${label}$`, 'i') })).toBeDisabled()
    }
    fireEvent.click(screen.getByRole('button', { name: /^high$/i }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
