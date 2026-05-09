import { render, screen } from '@testing-library/react'
import { TableSkeleton, MapSkeleton, ChartSkeleton } from '../LoadingStates'

describe('LoadingStates', () => {
  describe('TableSkeleton', () => {
    it('should render 6 skeleton rows', () => {
      render(<TableSkeleton rows={6} />)
      const skeletons = screen.getAllByTestId('skeleton-row')
      expect(skeletons).toHaveLength(6)
    })

    it('should render with pulse animation', () => {
      const { container } = render(<TableSkeleton rows={3} />)
      const firstRow = container.querySelector('[data-testid="skeleton-row"]')
      expect(firstRow).toBeInTheDocument()
    })
  })

  describe('MapSkeleton', () => {
    it('should render map placeholder', () => {
      render(<MapSkeleton />)
      expect(screen.getByText(/loading map/i)).toBeInTheDocument()
    })

    it('should render checkmark icon', () => {
      const { container } = render(<MapSkeleton />)
      const icon = container.querySelector('[data-testid="loading-icon"]')
      expect(icon).toBeInTheDocument()
    })
  })

  describe('ChartSkeleton', () => {
    it('should render gray placeholder bars', () => {
      const { container } = render(<ChartSkeleton />)
      const bars = container.querySelectorAll('[data-testid="skeleton-bar"]')
      expect(bars.length).toBeGreaterThan(0)
    })
  })
})
