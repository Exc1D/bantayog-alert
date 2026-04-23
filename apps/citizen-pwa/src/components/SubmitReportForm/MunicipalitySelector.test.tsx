import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MunicipalitySelector } from './MunicipalitySelector.js'
import { MUNI_LABELS_SORTED } from './location-constants.js'

describe('MunicipalitySelector', () => {
  it('renders with sorted municipality options', () => {
    render(<MunicipalitySelector value="" onChange={vi.fn()} />)

    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()

    // Should have default option + all municipalities
    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveTextContent('Select municipality...')
    expect(options).toHaveLength(1 + MUNI_LABELS_SORTED.length)

    // Verify sorted order: first should be Basud alphabetically
    expect(options[1]).toHaveTextContent('Basud')
  })

  it('calls onChange when selection changes', () => {
    const onChange = vi.fn()
    render(<MunicipalitySelector value="" onChange={onChange} />)

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'daet' } })

    expect(onChange).toHaveBeenCalledExactlyOnceWith('daet')
  })

  it('displays error message when provided', () => {
    render(
      <MunicipalitySelector value="" onChange={vi.fn()} error="Please select a municipality" />,
    )

    expect(screen.getByText('Please select a municipality')).toBeInTheDocument()
  })

  it('does not display error when error is undefined', () => {
    const { container } = render(<MunicipalitySelector value="" onChange={vi.fn()} />)

    expect(container.querySelector('.field-error')).not.toBeInTheDocument()
  })

  it('does not display error when error is null', () => {
    const { container } = render(<MunicipalitySelector value="" onChange={vi.fn()} error={null} />)

    expect(container.querySelector('.field-error')).not.toBeInTheDocument()
  })
})
