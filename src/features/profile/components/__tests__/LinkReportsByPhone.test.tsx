import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LinkReportsByPhone } from '../LinkReportsByPhone'

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
}))

// Mock firebase config (provides the db export)
vi.mock('@/app/firebase/config', () => ({
  db: {},
}))

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}))

describe('LinkReportsByPhone', () => {
  it('should display phone input field', () => {
    render(<LinkReportsByPhone onSuccess={vi.fn()} />)

    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument()
  })

  it('should show error for invalid phone format', async () => {
    const user = userEvent.setup()
    render(<LinkReportsByPhone onSuccess={vi.fn()} />)

    await user.type(screen.getByLabelText(/phone number/i), '123')
    await user.click(screen.getByRole('button', { name: /link reports/i }))

    expect(screen.getByText(/valid philippine phone/i)).toBeInTheDocument()
  })

  it('should call onSuccess when phone is valid and reports are found', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()

    // Mock getDocs to return a snapshot with reports
    const { getDocs } = await import('firebase/firestore')
    const mockSnapshot = {
      empty: false,
      docs: [
        {
          id: 'report-1',
          data: () => ({
            incidentType: 'flood',
            status: 'pending',
            createdAt: { toDate: () => new Date('2024-01-15') },
          }),
        },
        {
          id: 'report-2',
          data: () => ({
            incidentType: 'fire',
            status: 'resolved',
            createdAt: { toDate: () => new Date('2024-02-20') },
          }),
        },
      ],
    }
    ;(getDocs as ReturnType<typeof vi.fn>).mockResolvedValue(mockSnapshot)

    render(<LinkReportsByPhone onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText(/phone number/i), '+63 912 345 6789')
    await user.click(screen.getByRole('button', { name: /link reports/i }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(2)
    }, { timeout: 3000 })
  })

  it('should show "no reports found" message when phone has no reports', async () => {
    const user = userEvent.setup()

    // Mock getDocs to return an empty snapshot
    const { getDocs } = await import('firebase/firestore')
    const mockSnapshot = {
      empty: true,
      docs: [],
    }
    ;(getDocs as ReturnType<typeof vi.fn>).mockResolvedValue(mockSnapshot)

    render(<LinkReportsByPhone onSuccess={vi.fn()} />)

    await user.type(screen.getByLabelText(/phone number/i), '+63 999 999 9999')
    await user.click(screen.getByRole('button', { name: /link reports/i }))

    await waitFor(() => {
      expect(screen.getByText(/no reports found/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })
})
