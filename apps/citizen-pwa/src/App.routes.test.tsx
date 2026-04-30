import '@testing-library/jest-dom/vitest'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('./components/MapTab/index.js', () => ({
  MapTab: () => <div>Map tab</div>,
}))

vi.mock('./components/SubmitReportForm/index.js', () => ({
  SubmitReportForm: () => <div>Report form</div>,
}))

vi.mock('./components/ReceiptScreen.js', () => ({
  ReceiptScreen: () => <div>Receipt</div>,
}))

vi.mock('./components/LookupScreen.js', () => ({
  LookupScreen: () => <div>Lookup</div>,
}))

vi.mock('./components/FeedTab.js', () => ({
  FeedTab: () => <div>Feed tab</div>,
}))

vi.mock('./components/IncidentDetailPage.js', () => ({
  IncidentDetailPage: () => <div>Incident detail</div>,
}))

vi.mock('./pages/RegisterPage.js', () => ({
  RegisterPage: () => <div>Register page</div>,
}))

vi.mock('./pages/SettingsPage.js', () => ({
  SettingsPage: () => <div>Settings page</div>,
}))

async function renderAppAt(pathname: string) {
  window.history.pushState({}, '', pathname)
  vi.resetModules()
  const { App } = await import('./App.js')
  return render(<App />)
}

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('App routes', () => {
  it('shows the map tab shell at /', async () => {
    await renderAppAt('/')
    expect(screen.getByRole('banner')).toHaveTextContent('BANTAYOG ALERT')
    expect(screen.getByText('Map tab')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /map/i })).toHaveAttribute('aria-current', 'page')
  })

  it('shows the report form at /report', async () => {
    await renderAppAt('/report')
    expect(screen.getByText('Report form')).toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /main navigation/i })).not.toBeInTheDocument()
  })

  it('navigates between shell tabs', async () => {
    await renderAppAt('/')
    fireEvent.click(screen.getByRole('button', { name: /feed/i }))
    await waitFor(() => {
      expect(screen.getByText(/Feed tab/)).toBeInTheDocument()
    })
  })

  it('shows incident detail without shell chrome at /incidents/:id', async () => {
    await renderAppAt('/incidents/test-id')
    expect(screen.getByText('Incident detail')).toBeInTheDocument()
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /main navigation/i })).not.toBeInTheDocument()
  })

  it('shows register page at /register', async () => {
    await renderAppAt('/register')
    expect(screen.getByText('Register page')).toBeInTheDocument()
  })

  it('shows settings page at /settings', async () => {
    await renderAppAt('/settings')
    expect(screen.getByText('Settings page')).toBeInTheDocument()
  })
})
