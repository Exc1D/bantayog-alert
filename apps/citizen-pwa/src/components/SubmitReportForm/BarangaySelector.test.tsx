import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BarangaySelector } from './BarangaySelector.js'

describe('BarangaySelector', () => {
  it('renders nothing when municipalityId is empty', () => {
    const { container } = render(<BarangaySelector municipalityId="" value="" onChange={vi.fn()} />)

    expect(container.firstChild).toBeNull()
  })

  it('renders barangay options for the given municipality', () => {
    render(<BarangaySelector municipalityId="daet" value="" onChange={vi.fn()} />)

    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()

    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveTextContent('Select barangay (optional)...')

    // Daet has specific barangays — spot-check a couple
    expect(screen.getByRole('option', { name: 'Alawihao' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Bagasbas' })).toBeInTheDocument()
  })

  it('calls onChange when selection changes', () => {
    const onChange = vi.fn()
    render(<BarangaySelector municipalityId="daet" value="" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'Bagasbas' } })

    expect(onChange).toHaveBeenCalledExactlyOnceWith('Bagasbas')
  })

  it('shows optional label', () => {
    render(<BarangaySelector municipalityId="daet" value="" onChange={vi.fn()} />)

    expect(screen.getByText(/— optional/)).toBeInTheDocument()
  })

  it('reflects the value prop on the select element', () => {
    render(<BarangaySelector municipalityId="daet" value="Bagasbas" onChange={vi.fn()} />)

    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('Bagasbas')
  })
})
