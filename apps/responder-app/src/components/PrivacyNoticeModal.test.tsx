import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PrivacyNoticeModal } from './PrivacyNoticeModal.js'

const mockSetDoc = vi.fn((_docRef?: unknown, _data?: unknown) => Promise.resolve())
const mockGetDoc = vi.fn((..._args: unknown[]) => Promise.resolve({ data: () => ({}) }))

vi.mock('../app/firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'mock-doc-ref'),
  getDoc: vi.fn((...args: unknown[]) => mockGetDoc(...args)),
  setDoc: vi.fn((...args: unknown[]) => mockSetDoc(...args)),
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
}))

describe('PrivacyNoticeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows modal when consent version does not match', async () => {
    mockGetDoc.mockResolvedValue({
      data: () => ({ consentVersion: '0.9' }),
    })

    render(<PrivacyNoticeModal uid="user-123" />)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('does not show modal when consent version matches', async () => {
    mockGetDoc.mockResolvedValue({
      data: () => ({ consentVersion: '1.0' }),
    })

    render(<PrivacyNoticeModal uid="user-123" />)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('writes to user_consents collection on dismiss', async () => {
    mockGetDoc.mockResolvedValue({
      data: () => ({ consentVersion: '0.9' }),
    })

    render(<PrivacyNoticeModal uid="user-123" />)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const agreeButton = screen.getByText(/i agree/i)
    fireEvent.click(agreeButton)

    await waitFor(() => {
      expect(mockSetDoc).toHaveBeenCalledTimes(1)
    })
  })

  it('hides modal after successful write', async () => {
    mockGetDoc.mockResolvedValue({
      data: () => ({ consentVersion: '0.9' }),
    })

    render(<PrivacyNoticeModal uid="user-123" />)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const agreeButton = screen.getByText(/i agree/i)
    fireEvent.click(agreeButton)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('shows modal when read fails', async () => {
    mockGetDoc.mockRejectedValue(new Error('Network error'))

    render(<PrivacyNoticeModal uid="user-123" />)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })
})
