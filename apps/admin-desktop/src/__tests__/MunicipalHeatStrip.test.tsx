import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MunicipalHeatStrip } from '../components/MunicipalHeatStrip'

describe('MunicipalHeatStrip', () => {
  it('flags uncovered municipalities and deep-links on click', () => {
    const onSelect = vi.fn()
    render(
      <MunicipalHeatStrip
        data={[
          { municipality: 'Daet', activeIncidents: 3, activeResponders: 0 },
          { municipality: 'Labo', activeIncidents: 1, activeResponders: 2 },
        ]}
        onSelect={onSelect}
      />,
    )

    expect(screen.getByTitle('Daet: 3 active, 0 responders — uncovered')).toBeInTheDocument()
    expect(screen.getByTitle('Labo: 1 active, 2 responders')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle(/^Labo:/))
    expect(onSelect).toHaveBeenCalledWith('Labo')
  })

  it('renders nothing without data', () => {
    const { container } = render(<MunicipalHeatStrip data={[]} onSelect={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
