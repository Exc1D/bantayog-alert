import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FilterBar } from './FilterBar.js'
import type { Filters } from './types.js'

const defaultFilters: Filters = { municipality: '' }

describe('FilterBar', () => {
  it('shows All chip and municipality chips', () => {
    render(<FilterBar filters={defaultFilters} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^All$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Daet$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Basud$/i })).toBeInTheDocument()
  })

  it('calls onChange with selected municipality on click', () => {
    const onChange = vi.fn()
    render(<FilterBar filters={defaultFilters} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /^Daet$/i }))
    expect(onChange).toHaveBeenCalledWith({ municipality: 'Daet' })
  })

  it('calls onChange with empty string when All is clicked', () => {
    const onChange = vi.fn()
    render(<FilterBar filters={{ municipality: 'Daet' }} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /^All$/i }))
    expect(onChange).toHaveBeenCalledWith({ municipality: '' })
  })

  it('marks the active municipality chip as pressed', () => {
    render(<FilterBar filters={{ municipality: 'Daet' }} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^Daet$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^All$/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('disables all chips and blocks onChange when disabled', () => {
    const onChange = vi.fn()
    render(<FilterBar filters={defaultFilters} onChange={onChange} disabled />)
    expect(screen.getByRole('button', { name: /^All$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^Daet$/i })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /^Daet$/i }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
