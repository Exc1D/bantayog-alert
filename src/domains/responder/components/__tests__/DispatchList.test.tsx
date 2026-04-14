import { render, screen } from '@testing-library/react'
import { DispatchList } from '../DispatchList'
import { useDispatches } from '../../hooks/useDispatches'
import { useQuickStatus } from '../../hooks/useQuickStatus'

vi.mock('../../hooks/useDispatches')
vi.mock('../../hooks/useQuickStatus')

describe('DispatchList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display loading skeleton', () => {
    ;(useDispatches as any).mockReturnValue({
      dispatches: [],
      isLoading: true,
      error: null
    })
    ;(useQuickStatus as any).mockReturnValue({
      updateStatus: vi.fn(),
      isUpdating: false,
      pendingStatus: new Map()
    })

    render(<DispatchList />)

    // Should show skeleton (pulse animation divs)
    expect(document.body.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('should display dispatches', () => {
    ;(useDispatches as any).mockReturnValue({
      dispatches: [
        { id: 'dispatch-1', type: 'rescue', status: 'pending', urgency: 'high', incidentLocation: { address: '123 Main St' } }
      ],
      isLoading: false,
      error: null
    })
    ;(useQuickStatus as any).mockReturnValue({
      updateStatus: vi.fn(),
      isUpdating: false,
      pendingStatus: new Map()
    })

    render(<DispatchList />)

    expect(screen.getByText('rescue')).toBeVisible()
    expect(screen.getByText('123 Main St')).toBeVisible()
  })

  it('should display empty state when no dispatches', () => {
    ;(useDispatches as any).mockReturnValue({
      dispatches: [],
      isLoading: false,
      error: null
    })
    ;(useQuickStatus as any).mockReturnValue({
      updateStatus: vi.fn(),
      isUpdating: false,
      pendingStatus: new Map()
    })

    render(<DispatchList />)

    expect(screen.getByText('No Active Dispatches')).toBeVisible()
  })

  it('should display error state for permission denied', () => {
    ;(useDispatches as any).mockReturnValue({
      dispatches: [],
      isLoading: false,
      error: { code: 'PERMISSION_DENIED', message: 'Access denied', isFatal: true }
    })
    ;(useQuickStatus as any).mockReturnValue({
      updateStatus: vi.fn(),
      isUpdating: false,
      pendingStatus: new Map()
    })

    render(<DispatchList />)

    expect(screen.getByText('Session Expired')).toBeVisible()
    expect(screen.getByText('Sign In')).toBeVisible()
  })

  it('should call updateStatus when button clicked', () => {
    const mockUpdateStatus = vi.fn()

    ;(useDispatches as any).mockReturnValue({
      dispatches: [
        { id: 'dispatch-1', type: 'rescue', status: 'pending', urgency: 'high', incidentLocation: { address: '123 Main St' } }
      ],
      isLoading: false,
      error: null
    })
    ;(useQuickStatus as any).mockReturnValue({
      updateStatus: mockUpdateStatus,
      isUpdating: false,
      pendingStatus: new Map()
    })

    render(<DispatchList />)

    const enRouteButton = screen.getByRole('button', { name: /en route/i })
    enRouteButton.click()

    expect(mockUpdateStatus).toHaveBeenCalledWith('dispatch-1', 'en_route')
  })
})
