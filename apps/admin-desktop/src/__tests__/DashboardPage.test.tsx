import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage'

describe('DashboardPage', () => {
  it('renders header and status bar', () => {
    render(<DashboardPage />, { wrapper: BrowserRouter })
    expect(screen.getByText('PDRRMO Camarines Norte')).toBeInTheDocument()
    expect(screen.getByText('47')).toBeInTheDocument()
  })
})
