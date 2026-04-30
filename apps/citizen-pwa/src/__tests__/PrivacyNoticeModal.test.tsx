import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivacyNoticeModal } from '../components/PrivacyNoticeModal.js'

const STORAGE_KEY = 'bantayog_privacy_v1'

let store: Record<string, string> = {}

beforeEach(() => {
  store = {}
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      store[key] = undefined as unknown as string
    },
    clear: () => {
      store = {}
    },
  })
})

describe('PrivacyNoticeModal', () => {
  it('renders when localStorage key is absent', () => {
    render(<PrivacyNoticeModal uid={null} />)
    expect(screen.getByText(/Abiso sa Pagprotekta ng Datos/i)).toBeTruthy()
  })

  it('does not render when already dismissed', () => {
    localStorage.setItem(STORAGE_KEY, '1')
    render(<PrivacyNoticeModal uid={null} />)
    expect(screen.queryByText(/Abiso sa Pagprotekta ng Datos/i)).toBeNull()
  })

  it('sets localStorage key on dismiss', () => {
    render(<PrivacyNoticeModal uid={null} />)
    fireEvent.click(screen.getByRole('button', { name: /Sang-ayon/i }))
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
  })
})
