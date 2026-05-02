import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PrivacyNoticeModal } from './PrivacyNoticeModal.js'

// Hoisted mocks so vi.mock factories can reference them safely
const mockGetDoc = vi.hoisted(() => vi.fn())
const mockSetDoc = vi.hoisted(() => vi.fn())

vi.mock('../app/firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  doc: () => ({}),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  serverTimestamp: () => ({ _seconds: 1234567890, _nanoseconds: 0 }),
}))

describe('PrivacyNoticeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSetDoc.mockResolvedValue(undefined)
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

  it('shows modal on read failure', async () => {
    mockGetDoc.mockRejectedValue(new Error('Permission denied'))

    render(<PrivacyNoticeModal uid="user-123" />)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('writes consent doc with correct payload on dismiss', async () => {
    mockGetDoc.mockResolvedValue({
      data: () => ({ consentVersion: '0.9' }),
    })

    render(<PrivacyNoticeModal uid="user-123" />)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    const agreeButton = screen.getByRole('button', { name: /i agree/i })
    fireEvent.click(agreeButton)

    await waitFor(() => {
      expect(mockSetDoc).toHaveBeenCalledTimes(1)
      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          consentVersion: '1.0',
          consentGivenAt: expect.anything(),
          method: 'in_app_modal',
        }),
      )
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

    const agreeButton = screen.getByRole('button', { name: /i agree/i })
    fireEvent.click(agreeButton)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
