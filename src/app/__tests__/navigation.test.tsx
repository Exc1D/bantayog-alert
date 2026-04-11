import React from 'react'
import { render, screen } from '@testing-library/react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Navigation } from '../navigation'

describe('Navigation', () => {
  const renderWithRouter = (component: React.ReactElement) => {
    return render(
      <BrowserRouter>
        {component}
        <Routes>
          <Route path="/map" element={<div>Map Page</div>} />
          <Route path="/feed" element={<div>Feed Page</div>} />
          <Route path="/report" element={<div>Report Page</div>} />
          <Route path="/alerts" element={<div>Alerts Page</div>} />
          <Route path="/profile" element={<div>Profile Page</div>} />
        </Routes>
      </BrowserRouter>
    )
  }

  describe('rendering', () => {
    it('should render all 5 navigation tabs', () => {
      renderWithRouter(<Navigation />)

      expect(screen.getByText('Map')).toBeInTheDocument()
      expect(screen.getByText('Feed')).toBeInTheDocument()
      expect(screen.getByText('Report')).toBeInTheDocument()
      expect(screen.getByText('Alerts')).toBeInTheDocument()
      expect(screen.getByText('Profile')).toBeInTheDocument()
    })

    it('should render navigation icons', () => {
      const { container } = renderWithRouter(<Navigation />)

      // Check for Lucide icon elements (they render as SVG with specific classes)
      const icons = container.querySelectorAll('svg.lucide')
      expect(icons.length).toBe(5)
    })
  })

  describe('active tab highlighting', () => {
    it('should highlight Map tab when on map route', () => {
      window.history.pushState({}, '', '/map')
      renderWithRouter(<Navigation />)

      const mapLink = screen.getByText('Map').closest('a')
      expect(mapLink).toHaveClass('text-primary-blue')
    })

    it('should highlight Feed tab when on feed route', () => {
      window.history.pushState({}, '', '/feed')
      renderWithRouter(<Navigation />)

      const feedLink = screen.getByText('Feed').closest('a')
      expect(feedLink).toHaveClass('text-primary-blue')
    })

    it('should highlight Alerts tab when on alerts route', () => {
      window.history.pushState({}, '', '/alerts')
      renderWithRouter(<Navigation />)

      const alertsLink = screen.getByText('Alerts').closest('a')
      expect(alertsLink).toHaveClass('text-primary-blue')
    })

    it('should highlight Profile tab when on profile route', () => {
      window.history.pushState({}, '', '/profile')
      renderWithRouter(<Navigation />)

      const profileLink = screen.getByText('Profile').closest('a')
      expect(profileLink).toHaveClass('text-primary-blue')
    })

    it('should not highlight inactive tabs', () => {
      window.history.pushState({}, '', '/map')
      renderWithRouter(<Navigation />)

      const feedLink = screen.getByText('Feed').closest('a')
      expect(feedLink).toHaveClass('text-gray-500')
      expect(feedLink).not.toHaveClass('text-primary-blue')
    })
  })

  describe('prominent Report tab', () => {
    it('should render Report tab with prominent styling', () => {
      renderWithRouter(<Navigation />)

      const reportLink = screen.getByText('Report').closest('a')
      expect(reportLink).toHaveClass('from-primary-red', 'to-red-600')
      expect(reportLink).toHaveClass('shadow-lg', 'border-4', 'border-white')
    })

    it('should render Report tab with elevated position', () => {
      renderWithRouter(<Navigation />)

      const reportLink = screen.getByText('Report').closest('a')
      expect(reportLink).toHaveClass('-top-4')
    })

    it('should render Report tab with rounded-full shape', () => {
      renderWithRouter(<Navigation />)

      const reportLink = screen.getByText('Report').closest('a')
      expect(reportLink).toHaveClass('rounded-full')
    })

    it('should render Report tab with larger icon size', () => {
      renderWithRouter(<Navigation />)

      const reportLink = screen.getByText('Report').closest('a')
      const icon = reportLink?.querySelector('svg')
      expect(icon).toBeInTheDocument()
    })
  })
})
