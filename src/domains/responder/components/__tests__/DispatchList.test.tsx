import { render, screen, fireEvent } from '@testing-library/react'
import { DispatchList } from '../DispatchList'
import { useDispatches } from '../../hooks/useDispatches'
import { useQuickStatus } from '../../hooks/useQuickStatus'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
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
    const quickStatusController = {
      updateStatus: mockUpdateStatus,
      isUpdating: false,
      pendingStatus: new Map()
    }

    ;(useDispatches as any).mockReturnValue({
      dispatches: [
        { id: 'dispatch-1', type: 'rescue', status: 'pending', urgency: 'high', incidentLocation: { address: '123 Main St' } }
      ],
      isLoading: false,
      error: null
    })
    ;(useQuickStatus as any).mockReturnValue(quickStatusController)

    render(<DispatchList />)

    const enRouteButton = screen.getByRole('button', { name: /en route/i })
    enRouteButton.click()

    expect(mockUpdateStatus).toHaveBeenCalledWith('dispatch-1', 'en_route')
  })

  it('should display error state for AUTH_EXPIRED', () => {
    ;(useDispatches as any).mockReturnValue({
      dispatches: [],
      isLoading: false,
      error: { code: 'AUTH_EXPIRED', message: 'Auth token expired', isFatal: true }
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

  it('should display the error message from the error object', () => {
    ;(useDispatches as any).mockReturnValue({
      dispatches: [],
      isLoading: false,
      error: { code: 'PERMISSION_DENIED', message: 'Custom error message', isFatal: true }
    })
    ;(useQuickStatus as any).mockReturnValue({
      updateStatus: vi.fn(),
      isUpdating: false,
      pendingStatus: new Map()
    })

    render(<DispatchList />)

    expect(screen.getByText('Custom error message')).toBeVisible()
  })

  it('should display "Location pending..." when address is missing', () => {
    ;(useDispatches as any).mockReturnValue({
      dispatches: [
        { id: 'dispatch-1', type: 'rescue', status: 'pending', urgency: 'high', incidentLocation: { latitude: 14, longitude: 122 } }
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

    expect(screen.getByText('Location pending...')).toBeVisible()
  })

  it('should display landmark when present', () => {
    ;(useDispatches as any).mockReturnValue({
      dispatches: [
        {
          id: 'dispatch-1',
          type: 'medical',
          status: 'pending',
          urgency: 'medium',
          incidentLocation: { address: '456 Oak Ave', landmark: 'Near the hospital' }
        }
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

    expect(screen.getByText('Near: Near the hospital')).toBeVisible()
  })

  it('should display type with underscores replaced by spaces (citizen_report)', () => {
    ;(useDispatches as any).mockReturnValue({
      dispatches: [
        { id: 'dispatch-1', type: 'citizen_report', status: 'pending', urgency: 'low', incidentLocation: { address: '123 Main St' } }
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

    expect(screen.getByText('citizen report')).toBeVisible()
  })

  it('should call updateStatus with on_scene when On Scene button is clicked', () => {
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

    const onSceneButton = screen.getByRole('button', { name: /on scene/i })
    fireEvent.click(onSceneButton)

    expect(mockUpdateStatus).toHaveBeenCalledWith('dispatch-1', 'on_scene')
  })

  it('should call updateStatus with needs_assistance when Help button is clicked', () => {
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

    const helpButton = screen.getByRole('button', { name: /request assistance/i })
    fireEvent.click(helpButton)

    expect(mockUpdateStatus).toHaveBeenCalledWith('dispatch-1', 'needs_assistance')
  })

  it('should disable buttons when isUpdating is true', () => {
    ;(useDispatches as any).mockReturnValue({
      dispatches: [
        { id: 'dispatch-1', type: 'rescue', status: 'pending', urgency: 'high', incidentLocation: { address: '123 Main St' } }
      ],
      isLoading: false,
      error: null
    })
    ;(useQuickStatus as any).mockReturnValue({
      updateStatus: vi.fn(),
      isUpdating: true,
      pendingStatus: new Map()
    })

    render(<DispatchList />)

    expect(screen.getByRole('button', { name: /en route/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /on scene/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /request assistance/i })).toBeDisabled()
  })

  it('should show "Updating..." when dispatch is in pending state', () => {
    const pendingStatus = new Map([['dispatch-1', 'en_route']])

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
      pendingStatus
    })

    render(<DispatchList />)

    expect(screen.getByText('Updating...')).toBeVisible()
  })

  it('should call onDispatchClick when a dispatch card is clicked', () => {
    const mockOnDispatchClick = vi.fn()
    const dispatch = { id: 'dispatch-1', type: 'rescue', status: 'pending', urgency: 'high', incidentLocation: { address: '123 Main St' } }

    ;(useDispatches as any).mockReturnValue({
      dispatches: [dispatch],
      isLoading: false,
      error: null
    })
    ;(useQuickStatus as any).mockReturnValue({
      updateStatus: vi.fn(),
      isUpdating: false,
      pendingStatus: new Map()
    })

    render(<DispatchList onDispatchClick={mockOnDispatchClick} />)

    // Click on the dispatch address text to trigger card click
    fireEvent.click(screen.getByText('123 Main St'))

    expect(mockOnDispatchClick).toHaveBeenCalledWith(dispatch)
  })

  it('should render multiple dispatch cards', () => {
    ;(useDispatches as any).mockReturnValue({
      dispatches: [
        { id: 'dispatch-1', type: 'rescue', status: 'pending', urgency: 'high', incidentLocation: { address: '100 First St' } },
        { id: 'dispatch-2', type: 'medical', status: 'en_route', urgency: 'medium', incidentLocation: { address: '200 Second St' } },
        { id: 'dispatch-3', type: 'fire', status: 'on_scene', urgency: 'low', incidentLocation: { address: '300 Third St' } }
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

    expect(screen.getByText('100 First St')).toBeVisible()
    expect(screen.getByText('200 Second St')).toBeVisible()
    expect(screen.getByText('300 Third St')).toBeVisible()
  })

  it('should show exactly 3 skeleton items during loading', () => {
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

    const skeletonItems = document.body.querySelectorAll('.animate-pulse')
    expect(skeletonItems).toHaveLength(3)
  })
})
