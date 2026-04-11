import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../StatusBadge'

describe('StatusBadge', () => {
  describe('when status is verified', () => {
    it('should render with green background', () => {
      const { container } = render(<StatusBadge status="verified" />)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('bg-status-verified')
    })

    it('should display default text', () => {
      render(<StatusBadge status="verified" />)
      expect(screen.getByText('Verified')).toBeInTheDocument()
    })

    it('should display custom text when provided', () => {
      render(<StatusBadge status="verified" text="Custom Verified" />)
      expect(screen.getByText('Custom Verified')).toBeInTheDocument()
    })
  })

  describe('when status is pending', () => {
    it('should render with yellow background', () => {
      const { container } = render(<StatusBadge status="pending" />)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('bg-status-pending')
    })

    it('should display default text', () => {
      render(<StatusBadge status="pending" />)
      expect(screen.getByText('Pending')).toBeInTheDocument()
    })

    it('should display custom text when provided', () => {
      render(<StatusBadge status="pending" text="Awaiting Review" />)
      expect(screen.getByText('Awaiting Review')).toBeInTheDocument()
    })
  })

  describe('when status is resolved', () => {
    it('should render with green background', () => {
      const { container } = render(<StatusBadge status="resolved" />)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('bg-status-resolved')
    })

    it('should display default text', () => {
      render(<StatusBadge status="resolved" />)
      expect(screen.getByText('Resolved')).toBeInTheDocument()
    })

    it('should display custom text when provided', () => {
      render(<StatusBadge status="resolved" text="Completed" />)
      expect(screen.getByText('Completed')).toBeInTheDocument()
    })
  })

  describe('when status is false_alarm', () => {
    it('should render with gray background', () => {
      const { container } = render(<StatusBadge status="false_alarm" />)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass('bg-gray-400')
    })

    it('should display default text', () => {
      render(<StatusBadge status="false_alarm" />)
      expect(screen.getByText('False Alarm')).toBeInTheDocument()
    })
  })

  describe('common styling', () => {
    it('should apply common badge classes', () => {
      const { container } = render(<StatusBadge status="verified" />)
      const badge = container.firstChild as HTMLElement
      expect(badge).toHaveClass(
        'inline-block',
        'px-3',
        'py-1',
        'rounded-full',
        'text-xs',
        'font-medium',
        'text-white'
      )
    })
  })
})
