import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FilterBar, type Filters } from './FilterBar.js'

const filters: Filters = { severity: 'all', window: '24h' }

describe('FilterBar', () => {
  it('cycles severity and window filters', () => {
    const onChange = vi.fn()
    render(<FilterBar filters={filters} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /severity/i }))
    expect(onChange).toHaveBeenCalledWith({ severity: 'high', window: '24h' })

    fireEvent.click(screen.getByRole('button', { name: /window/i }))
    expect(onChange).toHaveBeenCalledWith({ severity: 'all', window: '7d' })
  })

  it('disables interaction when requested', () => {
    const onChange = vi.fn()
    render(<FilterBar filters={filters} onChange={onChange} disabled />)
    fireEvent.click(screen.getByRole('button', { name: /severity/i }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /severity/i })).toBeDisabled()
  })
})
