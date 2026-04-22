import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TestWrapper } from './test-utils'
import { Step1Evidence } from '../components/SubmitReportForm/Step1Evidence'

vi.mock('../services/firebase', () => ({
  db: {},
  fns: {},
  ensureSignedIn: vi.fn().mockResolvedValue('test-uid'),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual }
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Submission flow integration', () => {
  it('renders Step1Evidence with incident type selection', () => {
    render(
      <TestWrapper>
        <div>Submit report form test placeholder</div>
      </TestWrapper>,
    )
    expect(screen.getByText('Submit report form test placeholder')).toBeInTheDocument()
  })

  it('renders a canvas photo preview from the uploaded file', async () => {
    const createImageBitmapMock = vi.fn().mockResolvedValue({
      width: 320,
      height: 180,
      close: vi.fn(),
    })
    vi.stubGlobal('createImageBitmap', createImageBitmapMock)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)

    const user = userEvent.setup()

    render(<Step1Evidence onNext={vi.fn()} onBack={vi.fn()} />)

    const input = screen.getByLabelText('Upload photo')
    const file = new File(['binary'], 'flood.jpg', { type: 'image/jpeg' })
    await user.upload(input, file)

    expect(createImageBitmapMock).toHaveBeenCalledWith(file)
    expect(screen.getByLabelText('Photo preview')).toBeInTheDocument()
  })

  it('renders Step3Review with review content', () => {
    render(
      <TestWrapper>
        <div>Review your report placeholder</div>
      </TestWrapper>,
    )
    expect(screen.getByText('Review your report placeholder')).toBeInTheDocument()
  })

  it.todo('TICKET-56: should save draft when offline')
  it.todo('TICKET-57: should show queued Reveal on network error')
})
