import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage'
import { useCommandCenterStore } from '../stores/commandCenterStore'

describe('DashboardPage', () => {
  beforeEach(() => {
    useCommandCenterStore.setState({
      selectedMunicipalityId: null,
      selectedReportId: null,
      triageFilters: {},
      chartTimeRange: '7d',
      statusBarExpanded: false,
      statusBarExpandedOverride: null,
      mapBounds: null,
      activeOverlays: new Set(['all_incidents']),
      triagePanelOpen: false,
      lastSyncMessage: null,
    })
  })

  it('renders header and status bar', () => {
    render(<DashboardPage />, { wrapper: BrowserRouter })
    expect(screen.getByText('PDRRMO Camarines Norte')).toBeInTheDocument()
    expect(screen.getByText('Active Incidents')).toBeInTheDocument()
  })

  it('opens map window when M key pressed', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<DashboardPage />, { wrapper: BrowserRouter })
    fireEvent.keyDown(window, { key: 'm' })
    expect(openSpy).toHaveBeenCalledWith('/map', 'bantayog-map', 'width=1200,height=900')
    openSpy.mockRestore()
  })

  it('ignores shortcuts when input is focused', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<DashboardPage />, { wrapper: BrowserRouter })
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    fireEvent.keyDown(window, { key: 'm' })
    expect(openSpy).not.toHaveBeenCalled()
    document.body.removeChild(input)
    openSpy.mockRestore()
  })

  it('verifies focused report when V key pressed', () => {
    render(<DashboardPage />, { wrapper: BrowserRouter })
    // Click a row to focus it
    fireEvent.click(screen.getByText('Daet'))
    fireEvent.keyDown(window, { key: 'v' })
    expect(useCommandCenterStore.getState().lastSyncMessage).toEqual({
      type: 'triage:action',
      reportId: 'r1',
      action: 'verified',
    })
  })

  it('bulk verifies selected reports when Shift+V pressed', () => {
    render(<DashboardPage />, { wrapper: BrowserRouter })
    // Select all via checkbox
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
    fireEvent.keyDown(window, { key: 'V', shiftKey: true })
    // Bulk verify emits a single bulk-action message with all selected ids
    const msg = useCommandCenterStore.getState().lastSyncMessage
    expect(msg).toEqual({
      type: 'triage:bulk-action',
      reportIds: ['r1', 'r2'],
      action: 'verified',
    })
  })

  it('opens reject modal when R key pressed with focused report', () => {
    render(<DashboardPage />, { wrapper: BrowserRouter })
    fireEvent.click(screen.getByText('Daet'))
    fireEvent.keyDown(window, { key: 'r' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('clears selection and closes modal on Escape', () => {
    render(<DashboardPage />, { wrapper: BrowserRouter })
    // Select a report and open reject modal
    fireEvent.click(screen.getByText('Daet'))
    fireEvent.keyDown(window, { key: 'r' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Press escape
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useCommandCenterStore.getState().selectedReportId).toBeNull()
  })
})
