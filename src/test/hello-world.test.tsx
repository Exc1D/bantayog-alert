import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from '../app/App'

describe('App smoke test', () => {
  it('renders the app shell without crashing', () => {
    render(<App />)
    expect(screen.getByTestId('query-client-provider')).toBeInTheDocument()
  })

  it('shows age verification on first load', () => {
    render(<App />)
    expect(screen.getByText('Age Verification Required')).toBeInTheDocument()
  })
})
