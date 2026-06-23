import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PrivacyNoticeModal } from './PrivacyNoticeModal.js'

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

const storageKey = 'bantayog.responder.privacy-consent:user-123'

describe('PrivacyNoticeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.localStorage.clear()
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

  it('does not show modal when the Firestore consent version matches', async () => {
    mockGetDoc.mockResolvedValue({
      data: () => ({ consentVersion: '1.0' }),
    })

    render(<PrivacyNoticeModal uid="user-123" />)

    await waitFor(() => {
      expect(mockGetDoc).toHaveBeenCalledTimes(1)
      expect(globalThis.localStorage.getItem(storageKey)).toBe('1.0')
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('uses locally cached acceptance without reopening or rereading Firestore', async () => {
    globalThis.localStorage.setItem(storageKey, '1.0')

    render(<PrivacyNoticeModal uid="user-123" />)

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockGetDoc).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows modal on read failure when no local acceptance exists', async () => {
    mockGetDoc.mockRejectedValue(new Error('Permission denied'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(<PrivacyNoticeModal uid="user-123" />)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('writes consent doc and local acceptance on dismiss', async () => {
    mockGetDoc.mockResolvedValue({
      data: () => ({ consentVersion: '0.9' }),
    })

    render(<PrivacyNoticeModal uid="user-123" />)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /i agree/i }))

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
      expect(globalThis.localStorage.getItem(storageKey)).toBe('1.0')
    })
  })

  it('stays dismissed locally when the server write fails', async () => {
    mockGetDoc.mockResolvedValue({
      data: () => ({ consentVersion: '0.9' }),
    })
    mockSetDoc.mockRejectedValue(new Error('Network unavailable'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const { unmount } = render(<PrivacyNoticeModal uid="user-123" />)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /i agree/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(globalThis.localStorage.getItem(storageKey)).toBe('1.0')
    })

    unmount()
    mockGetDoc.mockClear()
    render(<PrivacyNoticeModal uid="user-123" />)

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockGetDoc).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
