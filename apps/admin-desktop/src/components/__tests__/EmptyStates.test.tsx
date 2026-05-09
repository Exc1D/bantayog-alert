import { render, screen } from '@testing-library/react'
import { EmptyTriage, EmptyMap, EmptyAnalytics } from '../EmptyStates'

describe('EmptyStates', () => {
  describe('EmptyTriage', () => {
    it('should render message and checkmark', () => {
      render(<EmptyTriage />)
      expect(screen.getByText(/no active incidents/i)).toBeInTheDocument()
      expect(screen.getByTestId('empty-checkmark')).toBeInTheDocument()
    })
  })

  describe('EmptyMap', () => {
    it('should render all clear message', () => {
      render(<EmptyMap />)
      expect(screen.getByText(/all clear/i)).toBeInTheDocument()
    })
  })

  describe('EmptyAnalytics', () => {
    it('should render no data message', () => {
      render(<EmptyAnalytics />)
      expect(screen.getByText(/no data for selected time range/i)).toBeInTheDocument()
    })
  })
})
