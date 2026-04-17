import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { App } from './App.js'

vi.mock('./useCitizenShell.js', () => ({
  useCitizenShell: () => ({
    status: 'ready',
    authState: 'signed-in',
    appCheckState: 'active',
    user: { uid: 'anon-123' },
    minAppVersion: { citizen: '0.1.0', admin: '0.1.0', responder: '0.1.0' },
    alerts: [
      {
        title: 'System online',
        body: 'Citizen shell wired for Phase 1.',
        severity: 'info',
        publishedAt: 1713350400000,
        publishedBy: 'phase-1-bootstrap',
      },
    ],
    error: null,
  }),
}))

describe('App', () => {
  it('renders auth status, app version, and the hello-world alert feed', () => {
    render(<App />)

    expect(screen.getByText(/anon-123/)).toBeInTheDocument()
    expect(screen.getByText(/System online/)).toBeInTheDocument()
    expect(screen.getByText(/0.1.0/)).toBeInTheDocument()
    expect(screen.getByText(/signed-in/)).toBeInTheDocument()
  })
})
