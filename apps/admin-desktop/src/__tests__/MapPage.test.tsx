import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MapPage from '../pages/MapPage'

describe('MapPage', () => {
  it('renders header and map', () => {
    const { container } = render(<MapPage />)
    expect(screen.getByText('Provincial Map — Camarines Norte')).toBeInTheDocument()
    expect(container.querySelector('.leaflet-container')).toBeInTheDocument()
  })
})
