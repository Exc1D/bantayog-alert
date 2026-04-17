import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from './App.js'

const { useCitizenShell } = vi.hoisted(() => {
  const defaultShellState = {
    status: 'ready',
    authState: 'signed-in',
    appCheckState: 'active',
    user: { uid: 'anon-123' },
    minAppVersion: {
      citizen: '0.1.0',
      admin: '0.1.0',
      responder: '0.1.0',
      updatedAt: 1713350400000,
    },
    alerts: [
      {
        id: 'phase1-hello',
        title: 'System online',
        body: 'Citizen shell wired for Phase 1.',
        severity: 'info',
        publishedAt: 1713350400000,
        publishedBy: 'phase-1-bootstrap',
      },
    ],
    error: null,
  }
  return {
    useCitizenShell: vi.fn().mockReturnValue(defaultShellState),
  }
})

vi.mock('./useCitizenShell.js', () => ({
  useCitizenShell,
}))

describe('App', () => {
  it('renders auth status, app version, and the hello-world alert feed', () => {
    render(<App />)
    expect(screen.getByText('anon-123')).toBeInTheDocument()
    expect(screen.getByText('System online')).toBeInTheDocument()
    expect(screen.getByText('0.1.0')).toBeInTheDocument()
    expect(screen.getByText('signed-in')).toBeInTheDocument()
  })

  it('renders error message when status is error', () => {
    useCitizenShell.mockReturnValueOnce({
      status: 'error',
      authState: 'signed-out',
      appCheckState: 'failed',
      user: null,
      minAppVersion: null,
      alerts: [],
      error: 'Firebase initialization failed',
    })
    render(<App />)
    expect(screen.getByText('Firebase initialization failed')).toBeInTheDocument()
  })

  it('renders signed-out state correctly', () => {
    useCitizenShell.mockReturnValueOnce({
      status: 'ready',
      authState: 'signed-out',
      appCheckState: 'pending',
      user: null,
      minAppVersion: null,
      alerts: [],
      error: null,
    })
    render(<App />)
    expect(screen.getByText('signed-out')).toBeInTheDocument()
  })
})
