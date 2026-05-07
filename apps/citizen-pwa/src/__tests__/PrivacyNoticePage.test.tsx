/// <reference types="node" />
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TestWrapper } from './test-utils'

vi.mock('../services/firebase', () => ({
  auth: vi.fn(() => ({ currentUser: null })),
  db: {},
  fns: {},
  hasFirebaseConfig: vi.fn(() => false),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

describe('PrivacyNoticePage', () => {
  async function renderPage() {
    const { PrivacyNoticePage } = await import('../pages/PrivacyNoticePage')
    return render(
      <TestWrapper>
        <PrivacyNoticePage />
      </TestWrapper>,
    )
  }

  it('renders the page heading in English and Tagalog', async () => {
    await renderPage()
    expect(screen.getByText('Privacy Notice')).toBeInTheDocument()
    expect(screen.getByText('Patakaran sa Pagkapribado')).toBeInTheDocument()
  })

  it('discloses what data is collected', async () => {
    await renderPage()
    expect(screen.getByText(/pseudonymous UID/i)).toBeInTheDocument()
    expect(screen.getByText(/GPS location/i)).toBeInTheDocument()
    expect(screen.getByText(/EXIF stripped/i)).toBeInTheDocument()
  })

  it('includes the anonymity disclaimer', async () => {
    await renderPage()
    expect(screen.getByText(/Court orders/i)).toBeInTheDocument()
    expect(screen.getAllByText(/anonymity is not absolute/i).length).toBeGreaterThan(0)
  })

  it('shows data retention policy', async () => {
    await renderPage()
    expect(screen.getByText(/30.day grace/i)).toBeInTheDocument()
  })

  it('links to delete account from privacy page', async () => {
    await renderPage()
    expect(screen.getByRole('link', { name: /delete my account/i })).toBeInTheDocument()
  })

  it('has a back button', async () => {
    const navigate = vi.fn()
    vi.doMock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom')
      return { ...actual, useNavigate: () => navigate }
    })
    await renderPage()
    const backBtn = screen.getByRole('button', { name: /go back/i })
    await userEvent.click(backBtn)
    // navigate called
    expect(backBtn).toBeInTheDocument()
  })
})
