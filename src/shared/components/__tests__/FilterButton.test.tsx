import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterButton } from '../FilterButton'

describe('FilterButton', () => {
  it('should render filter icon', () => {
    render(<FilterButton onClick={() => {}} aria-label="Filter" />)

    const button = screen.getByRole('button', { name: 'Filter' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-label', 'Filter')
  })

  it('should render badge with count when filters are active', () => {
    render(<FilterButton onClick={() => {}} aria-label="Filter" activeFilterCount={3} />)

    const badge = screen.getByTestId('filter-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('3')
  })

  it('should not render badge when no filters are active', () => {
    render(<FilterButton onClick={() => {}} aria-label="Filter" activeFilterCount={0} />)

    const badge = screen.queryByTestId('filter-badge')
    expect(badge).not.toBeInTheDocument()
  })

  it('should show "9+" for counts greater than 9', () => {
    render(<FilterButton onClick={() => {}} aria-label="Filter" activeFilterCount={15} />)

    const badge = screen.getByTestId('filter-badge')
    expect(badge).toHaveTextContent('9+')
  })

  it('should call onClick handler when clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(<FilterButton onClick={handleClick} aria-label="Filter" />)

    const button = screen.getByRole('button', { name: 'Filter' })
    await user.click(button)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should be disabled when disabled prop is true', () => {
    render(<FilterButton onClick={() => {}} aria-label="Filter" disabled />)

    const button = screen.getByRole('button', { name: 'Filter' })
    expect(button).toBeDisabled()
  })

  it('should have correct styling classes', () => {
    render(<FilterButton onClick={() => {}} aria-label="Filter" />)

    const button = screen.getByRole('button', { name: 'Filter' })
    expect(button).toHaveClass('bg-white', 'rounded-lg', 'shadow-lg')
  })
})
